import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeavesService } from '../leaves/leaves.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';
import { WeeklyTimesheetDto } from './dto/weekly-timesheet.dto';
import { MonthlyTimesheetDto } from './dto/monthly-timesheet.dto';
import { TeamTimesheetDto } from './dto/team-timesheet.dto';
import { ExportTimesheetDto } from './dto/export-timesheet.dto';
import { BulkValidateDto } from './dto/bulk-validate.dto';

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leavesService: LeavesService,
  ) {}

  async findAll(dto: ListTimeEntriesDto) {
    const { page, limit, taskId, employeeId, dateFrom, dateTo, isValidated } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (taskId) where['taskId'] = taskId;
    if (employeeId) where['employeeId'] = employeeId;
    if (isValidated !== undefined) where['isValidated'] = isValidated;
    if (dateFrom || dateTo) {
      where['date'] = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          task: { select: { id: true, reference: true, title: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id },
      include: {
        task: { select: { id: true, reference: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    return entry;
  }

  async create(dto: CreateTimeEntryDto, userId: string) {
    const dayStart = new Date(dto.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dto.date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await this.prisma.timeEntry.aggregate({
      where: {
        employeeId: dto.employeeId,
        date: { gte: dayStart, lte: dayEnd },
      },
      _sum: { hours: true },
    });

    const currentTotal = Number(existing._sum.hours ?? 0);
    if (currentTotal + dto.hours > 24) {
      throw new BadRequestException(
        `Adding ${dto.hours}h would exceed the 24h daily cap. Current total: ${currentTotal}h.`,
      );
    }

    return this.prisma.timeEntry.create({
      data: { ...dto, userId },
      include: {
        task: { select: { id: true, reference: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTimeEntryDto) {
    const current = await this.findOne(id);

    // Block update if validated
    if ((current as any).isValidated) {
      throw new BadRequestException('Cannot modify a validated time entry');
    }

    if (dto.hours !== undefined || dto.date !== undefined || dto.employeeId !== undefined) {
      const targetDate = dto.date ?? (current as Record<string, unknown>)['date'] as Date;
      const targetEmployee = dto.employeeId ?? (current as Record<string, unknown>)['employeeId'] as string;
      const targetHours = dto.hours ?? Number((current as Record<string, unknown>)['hours']);

      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const existing = await this.prisma.timeEntry.aggregate({
        where: {
          employeeId: targetEmployee,
          date: { gte: dayStart, lte: dayEnd },
          id: { not: id },
        },
        _sum: { hours: true },
      });

      const otherTotal = Number(existing._sum.hours ?? 0);
      if (otherTotal + targetHours > 24) {
        throw new BadRequestException(
          `Update would exceed the 24h daily cap. Other entries total: ${otherTotal}h.`,
        );
      }
    }

    return this.prisma.timeEntry.update({
      where: { id },
      data: dto,
      include: {
        task: { select: { id: true, reference: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    const entry = await this.findOne(id);

    // Block delete if validated
    if ((entry as any).isValidated) {
      throw new BadRequestException('Cannot delete a validated time entry');
    }

    return this.prisma.timeEntry.delete({ where: { id } });
  }

  async validate(id: string) {
    await this.findOne(id);
    return this.prisma.timeEntry.update({ where: { id }, data: { isValidated: true } });
  }

  // ── Timesheet methods ─────────────────────────────────────────────

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private async getWorkScheduleForEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { contractType: true },
    });

    if (employee?.contractType) {
      const schedule = await this.prisma.workSchedule.findUnique({
        where: { contractType: employee.contractType },
      });
      if (schedule) return schedule;
    }

    // Default: 8h Mon-Fri
    return {
      mondayHours: 8, tuesdayHours: 8, wednesdayHours: 8,
      thursdayHours: 8, fridayHours: 8, saturdayHours: 0, sundayHours: 0,
      weeklyHours: 40,
    };
  }

  private getDayHours(schedule: any, dayIndex: number): number {
    const keys = ['sundayHours', 'mondayHours', 'tuesdayHours', 'wednesdayHours', 'thursdayHours', 'fridayHours', 'saturdayHours'];
    return Number(schedule[keys[dayIndex]] ?? 0);
  }

  async getWeeklyTimesheet(dto: WeeklyTimesheetDto) {
    const weekStart = this.getMonday(new Date(dto.weekStart));
    const weekEnd = this.addDays(weekStart, 6);
    weekEnd.setHours(23, 59, 59, 999);

    const [entries, leaves, holidays, schedule] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: {
          employeeId: dto.employeeId,
          date: { gte: weekStart, lte: weekEnd },
        },
        include: {
          task: {
            select: {
              id: true, reference: true, title: true,
              project: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: dto.employeeId,
          status: 'approuve',
          startDate: { lte: weekEnd },
          endDate: { gte: weekStart },
        },
        include: { leaveType: { select: { name: true } } },
      }),
      this.prisma.publicHoliday.findMany({
        where: {
          date: { gte: weekStart, lte: weekEnd },
        },
      }),
      this.getWorkScheduleForEmployee(dto.employeeId),
    ]);

    const holidayDates = new Set(holidays.map(h => this.formatDate(h.date)));
    const leaveDateMap = new Map<string, string>();
    for (const leave of leaves) {
      const current = new Date(leave.startDate);
      while (current <= leave.endDate && current <= weekEnd) {
        if (current >= weekStart) {
          leaveDateMap.set(this.formatDate(current), (leave.leaveType as any)?.name ?? 'Congé');
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Build days array
    const days = [];
    let weeklyTotal = 0;
    let weeklyExpected = 0;
    let leaveDays = 0;

    for (let i = 0; i < 7; i++) {
      const date = this.addDays(weekStart, i);
      const dateStr = this.formatDate(date);
      const dayEntries = entries.filter(e => this.formatDate(e.date) === dateStr);
      const dayTotal = dayEntries.reduce((sum, e) => sum + Number(e.hours), 0);
      const expected = this.getDayHours(schedule, date.getDay());
      const isLeave = leaveDateMap.has(dateStr);
      const isHoliday = holidayDates.has(dateStr);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      weeklyTotal += dayTotal;
      if (!isLeave && !isHoliday && !isWeekend) {
        weeklyExpected += expected;
      }
      if (isLeave) leaveDays++;

      days.push({
        date: dateStr,
        dayOfWeek: date.getDay(),
        entries: dayEntries,
        total: dayTotal,
        expected,
        isLeave,
        leaveType: leaveDateMap.get(dateStr),
        isHoliday,
        holidayName: holidays.find(h => this.formatDate(h.date) === dateStr)?.label,
        isWeekend,
        conflict: isLeave && dayTotal > 0,
      });
    }

    // Build task rows (pivot: task × day)
    const taskMap = new Map<string, any>();
    for (const entry of entries) {
      const taskId = entry.taskId;
      if (!taskMap.has(taskId)) {
        taskMap.set(taskId, {
          taskId,
          taskReference: (entry as any).task?.reference,
          taskTitle: (entry as any).task?.title,
          projectName: (entry as any).task?.project?.title,
          projectId: (entry as any).task?.project?.id,
          days: Array(7).fill(null).map(() => ({ hours: 0, entries: [] as any[] })),
          total: 0,
        });
      }
      const row = taskMap.get(taskId);
      const dayIndex = Math.floor((entry.date.getTime() - weekStart.getTime()) / (86400000));
      if (dayIndex >= 0 && dayIndex < 7) {
        row.days[dayIndex].hours += Number(entry.hours);
        row.days[dayIndex].entries.push(entry);
      }
      row.total += Number(entry.hours);
    }

    const occupationRate = weeklyExpected > 0 ? Math.round((weeklyTotal / weeklyExpected) * 100) : 0;

    return {
      weekStart: this.formatDate(weekStart),
      weekEnd: this.formatDate(weekEnd),
      days,
      taskRows: Array.from(taskMap.values()),
      weeklyTotal,
      weeklyExpected,
      leaveDays,
      occupationRate,
    };
  }

  async getMonthlyTimesheet(dto: MonthlyTimesheetDto) {
    const [year, month] = dto.month.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const [entries, leaves, holidays, schedule] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: {
          employeeId: dto.employeeId,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: dto.employeeId,
          status: 'approuve',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
      }),
      this.prisma.publicHoliday.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
      }),
      this.getWorkScheduleForEmployee(dto.employeeId),
    ]);

    const holidayDates = new Set(holidays.map(h => this.formatDate(h.date)));
    const leaveDates = new Set<string>();
    for (const leave of leaves) {
      const current = new Date(leave.startDate);
      while (current <= leave.endDate && current <= monthEnd) {
        if (current >= monthStart) leaveDates.add(this.formatDate(current));
        current.setDate(current.getDate() + 1);
      }
    }

    // Group entries by date
    const entryByDate = new Map<string, number>();
    for (const entry of entries) {
      const dateStr = this.formatDate(entry.date);
      entryByDate.set(dateStr, (entryByDate.get(dateStr) ?? 0) + Number(entry.hours));
    }

    const daysInMonth = monthEnd.getDate();
    const days = [];
    let monthlyTotal = 0;
    let monthlyExpected = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = this.formatDate(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isHoliday = holidayDates.has(dateStr);
      const isLeave = leaveDates.has(dateStr);
      const hours = entryByDate.get(dateStr) ?? 0;
      const expected = this.getDayHours(schedule, date.getDay());

      monthlyTotal += hours;
      if (!isLeave && !isHoliday && !isWeekend) {
        monthlyExpected += expected;
      }

      let status: string;
      if (isWeekend) status = 'weekend';
      else if (isHoliday) status = 'holiday';
      else if (isLeave) status = 'leave';
      else if (hours >= expected && expected > 0) status = 'full';
      else if (hours > 0) status = 'partial';
      else status = 'missing';

      days.push({ date: dateStr, dayOfMonth: d, dayOfWeek: date.getDay(), hours, expected, status, isWeekend, isHoliday, isLeave });
    }

    // Week summaries
    const weekSummaries = [];
    let weekStart = this.getMonday(monthStart);
    while (weekStart <= monthEnd) {
      const weekEnd = this.addDays(weekStart, 6);
      const weekDays = days.filter(d => {
        const dd = new Date(d.date);
        return dd >= weekStart && dd <= weekEnd;
      });
      weekSummaries.push({
        weekStart: this.formatDate(weekStart),
        total: weekDays.reduce((s, d) => s + d.hours, 0),
        expected: weekDays.filter(d => !d.isWeekend && !d.isHoliday && !d.isLeave).reduce((s, d) => s + d.expected, 0),
      });
      weekStart = this.addDays(weekStart, 7);
    }

    const occupationRate = monthlyExpected > 0 ? Math.round((monthlyTotal / monthlyExpected) * 100) : 0;

    return {
      month: dto.month,
      days,
      weekSummaries,
      monthlyTotal,
      monthlyExpected,
      occupationRate,
    };
  }

  async getTeamTimesheet(dto: TeamTimesheetDto, userId: string) {
    const weekStart = this.getMonday(new Date(dto.weekStart));
    const weekEnd = this.addDays(weekStart, 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Find the manager's employee record
    const manager = await this.prisma.employee.findUnique({ where: { userId } });

    // Get subordinates
    let subordinates;
    if (dto.managerId) {
      subordinates = await this.prisma.employee.findMany({ where: { managerId: dto.managerId } });
    } else if (manager) {
      subordinates = await this.prisma.employee.findMany({ where: { managerId: manager.id } });
    } else {
      // Super admin / gerant: show all employees
      subordinates = await this.prisma.employee.findMany();
    }

    const results = await Promise.all(
      subordinates.map(async (emp) => {
        const schedule = await this.getWorkScheduleForEmployee(emp.id);

        const entries = await this.prisma.timeEntry.findMany({
          where: {
            employeeId: emp.id,
            date: { gte: weekStart, lte: weekEnd },
          },
        });

        const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
        const validatedCount = entries.filter(e => e.isValidated).length;
        const pendingCount = entries.filter(e => !e.isValidated).length;

        // Calculate expected hours for business days only
        let expectedHours = 0;
        for (let i = 0; i < 7; i++) {
          const d = this.addDays(weekStart, i);
          if (d.getDay() !== 0 && d.getDay() !== 6) {
            expectedHours += this.getDayHours(schedule, d.getDay());
          }
        }

        const occupationRate = expectedHours > 0 ? Math.round((totalHours / expectedHours) * 100) : 0;

        return {
          employeeId: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          totalHours,
          expectedHours,
          occupationRate,
          validatedCount,
          pendingCount,
          pendingEntryIds: entries.filter(e => !e.isValidated).map(e => e.id),
        };
      }),
    );

    const teamTotal = results.reduce((sum, r) => sum + r.totalHours, 0);
    const teamExpected = results.reduce((sum, r) => sum + r.expectedHours, 0);

    return {
      weekStart: this.formatDate(weekStart),
      weekEnd: this.formatDate(weekEnd),
      subordinates: results,
      teamTotal,
      teamExpected,
    };
  }

  async exportTimesheet(dto: ExportTimesheetDto) {
    const where: any = {
      date: { gte: dto.dateFrom, lte: dto.dateTo },
    };
    if (dto.employeeId) where.employeeId = dto.employeeId;

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        task: { select: { reference: true, title: true, project: { select: { title: true } } } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    });

    // Generate CSV with BOM for Excel UTF-8 compat
    const BOM = '\uFEFF';
    const header = 'Date;Employé;Réf Tâche;Projet;Heures;Commentaire;Validé';
    const rows = entries.map((e: any) => {
      const date = this.formatDate(e.date);
      const employee = `${e.employee?.firstName ?? ''} ${e.employee?.lastName ?? ''}`.trim();
      const taskRef = e.task?.reference ?? '';
      const project = e.task?.project?.title ?? '';
      const hours = Number(e.hours).toFixed(2);
      const comment = (e.comment ?? '').replace(/;/g, ',').replace(/\n/g, ' ');
      const validated = e.isValidated ? 'Oui' : 'Non';
      return `${date};${employee};${taskRef};${project};${hours};${comment};${validated}`;
    });

    const data = BOM + [header, ...rows].join('\n');
    const dateFrom = this.formatDate(dto.dateFrom);
    const dateTo = this.formatDate(dto.dateTo);
    const filename = `pointage_${dateFrom}_${dateTo}.csv`;

    return { filename, contentType: 'text/csv; charset=utf-8', data };
  }

  async bulkValidate(dto: BulkValidateDto, userId: string) {
    // Check that the user is a manager of these entries' employees (or is admin)
    const manager = await this.prisma.employee.findUnique({ where: { userId } });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    const isAdmin = user?.role?.name === 'super_admin' || user?.role?.name === 'gerant';

    if (!isAdmin && manager) {
      // Verify all entries belong to subordinates
      const entries = await this.prisma.timeEntry.findMany({
        where: { id: { in: dto.ids } },
        include: { employee: { select: { managerId: true } } },
      });

      const unauthorized = entries.filter(e => e.employee?.managerId !== manager.id);
      if (unauthorized.length > 0) {
        throw new ForbiddenException('Some entries do not belong to your subordinates');
      }
    }

    const result = await this.prisma.timeEntry.updateMany({
      where: { id: { in: dto.ids } },
      data: { isValidated: true },
    });

    return { validated: result.count };
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto, ApproveLeaveDto } from './dto/create-leave.dto';
import { ListLeavesDto } from './dto/list-leaves.dto';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  // Calculate business days between two dates (excludes weekends + public holidays)
  async calculateBusinessDays(start: Date, end: Date, country: string = 'FR'): Promise<number> {
    const year = start.getFullYear();
    const holidays = await this.prisma.publicHoliday.findMany({
      where: { year, country },
      select: { date: true },
    });
    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));

    let days = 0;
    const current = new Date(start);
    while (current <= end) {
      const dow = current.getDay(); // 0=Sun, 6=Sat
      const dateStr = current.toISOString().split('T')[0];
      if (dow !== 0 && dow !== 6 && !holidayDates.has(dateStr)) {
        days += 1;
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  async findAll(dto: ListLeavesDto) {
    const { page, limit, employeeId, status, leaveTypeId, startDateFrom, startDateTo } = dto;
    const skip = (page - 1) * limit;

    const where = {
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
      ...(leaveTypeId ? { leaveTypeId } : {}),
      ...(startDateFrom || startDateTo ? {
        startDate: {
          ...(startDateFrom ? { gte: new Date(startDateFrom) } : {}),
          ...(startDateTo ? { lte: new Date(startDateTo) } : {}),
        },
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
          leaveType: { select: { id: true, name: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { include: { manager: { select: { id: true, firstName: true, lastName: true, user: { select: { id: true } } } } } },
        leaveType: true,
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    return leave;
  }

  async create(dto: CreateLeaveDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const days = await this.calculateBusinessDays(startDate, endDate);

    if (days === 0) {
      throw new BadRequestException('No working days in the selected period');
    }

    const leave = await this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        days,
        reason: dto.reason,
        status: 'en_attente',
      },
      include: {
        employee: {
          include: { manager: { select: { id: true, firstName: true, lastName: true } } },
        },
        leaveType: true,
      },
    });

    // Notify manager via Notification entity if manager exists
    if (leave.employee.manager) {
      const managerUser = await this.prisma.user.findFirst({
        where: { employee: { id: leave.employee.managerId! } },
      });
      if (managerUser) {
        await this.prisma.notification.create({
          data: {
            userId: managerUser.id,
            type: 'leave_request',
            title: 'Nouvelle demande de congé',
            body: `${leave.employee.firstName} ${leave.employee.lastName} a soumis une demande de congé du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')} (${days} jour(s)).`,
            link: `/leaves/${leave.id}`,
          },
        });
      }
    }

    return leave;
  }

  async approve(id: string, approverId: string, dto: ApproveLeaveDto) {
    const leave = await this.findOne(id);
    if (leave.status !== 'en_attente') {
      throw new BadRequestException(`Leave request is already ${leave.status}`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'approuve',
        approverId,
        comment: dto.comment,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } }, leaveType: true },
    });

    // Notify employee
    const employeeUser = await this.prisma.user.findFirst({
      where: { employee: { id: leave.employeeId } },
    });
    if (employeeUser) {
      await this.prisma.notification.create({
        data: {
          userId: employeeUser.id,
          type: 'leave_approved',
          title: 'Demande de congé approuvée',
          body: `Votre demande de congé du ${leave.startDate.toLocaleDateString('fr-FR')} au ${leave.endDate.toLocaleDateString('fr-FR')} a été approuvée.`,
          link: `/leaves/${id}`,
        },
      });
    }

    return updated;
  }

  async refuse(id: string, approverId: string, dto: ApproveLeaveDto) {
    const leave = await this.findOne(id);
    if (leave.status !== 'en_attente') {
      throw new BadRequestException(`Leave request is already ${leave.status}`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'refuse', approverId, comment: dto.comment },
    });

    // Notify employee
    const employeeUser = await this.prisma.user.findFirst({
      where: { employee: { id: leave.employeeId } },
    });
    if (employeeUser) {
      await this.prisma.notification.create({
        data: {
          userId: employeeUser.id,
          type: 'leave_refused',
          title: 'Demande de congé refusée',
          body: `Votre demande de congé du ${leave.startDate.toLocaleDateString('fr-FR')} au ${leave.endDate.toLocaleDateString('fr-FR')} a été refusée.${dto.comment ? ` Motif: ${dto.comment}` : ''}`,
          link: `/leaves/${id}`,
        },
      });
    }

    return updated;
  }

  async cancel(id: string, requestingEmployeeId: string) {
    const leave = await this.findOne(id);
    if (leave.employeeId !== requestingEmployeeId) {
      throw new BadRequestException('You can only cancel your own leave requests');
    }
    if (!['en_attente'].includes(leave.status)) {
      throw new BadRequestException('Only pending leave requests can be cancelled');
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'annule' },
    });
  }

  async getLeaveTypes() {
    return this.prisma.leaveType.findMany({ orderBy: { name: 'asc' } });
  }

  async createLeaveType(name: string, daysPerYear?: number, isCarryOver?: boolean) {
    return this.prisma.leaveType.create({ data: { name, daysPerYear, isCarryOver: isCarryOver ?? false } });
  }
}

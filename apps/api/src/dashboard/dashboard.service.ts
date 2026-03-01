import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductionQueryDto } from './dto/production-query.dto';
import { FinancierQueryDto } from './dto/financier-query.dto';
import type {
  GeneralDashboard,
  ProductionDashboard,
  FinancierDashboard,
  ClientDashboard,
  EmployeeDashboard,
  RentabiliteDashboard,
} from '@exeteam/shared';

function getMonthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function getWeekLabel(date: Date): string {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const week = Math.ceil((dayOfYear + start.getDay() + 1) / 7);
  return `S${String(week).padStart(2, '0')}/${y}`;
}

function last8Weeks(): { start: Date; end: Date; label: string }[] {
  const weeks: { start: Date; end: Date; label: string }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1 - i * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    weeks.push({ start: monday, end: sunday, label: getWeekLabel(monday) });
  }
  return weeks;
}

function countBusinessDays(start: Date, end: Date, holidays: Date[]): number {
  const holidaySet = new Set(
    holidays.map((h) => h.toISOString().slice(0, 10)),
  );
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(cur.toISOString().slice(0, 10))) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── General ──────────────────────────────────────────────────────────────

  async getGeneral(): Promise<GeneralDashboard> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      clientsTotal,
      clientsNew,
      projectsTotal,
      projectsEnCours,
      projectsTermines,
      tasksTotal,
      tasksEnCours,
      tasksTerminees,
      tasksEnRetard,
      employeesTotal,
      employeesEnConge,
      invoicesEmises,
      invoicesEncaissees,
      tasksByStatusRaw,
      projectsByStatusRaw,
    ] = await Promise.all([
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.client.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.project.count({ where: { deletedAt: null, status: { in: ['en_cours', 'en_revision'] } } }),
      this.prisma.project.count({ where: { deletedAt: null, status: { in: ['terminee', 'livree'] } } }),
      this.prisma.task.count({ where: { deletedAt: null } }),
      this.prisma.task.count({ where: { deletedAt: null, status: { in: ['en_cours', 'en_revision'] } } }),
      this.prisma.task.count({ where: { deletedAt: null, status: { in: ['terminee', 'livree'] } } }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          status: { notIn: ['terminee', 'livree', 'annulee'] },
          plannedEndDate: { lt: now },
        },
      }),
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.leaveRequest.count({
        where: {
          status: 'approuve',
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
      this.prisma.invoice.aggregate({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
        _sum: { totalHt: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          status: 'payee',
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { totalHt: true },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
    ]);

    // Rendement moyen: avg rendement across all tasks that have timeEntries
    const tasksWithTime = await this.prisma.task.findMany({
      where: { deletedAt: null, timeEntries: { some: {} } },
      include: {
        codeProduit: { select: { timeGamme: true } },
        timeEntries: { select: { hours: true } },
      },
    });

    let rendementSum = 0;
    let rendementCount = 0;
    for (const task of tasksWithTime) {
      const totalHours = task.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
      if (totalHours > 0 && task.codeProduit?.timeGamme) {
        const rendement = (Number(task.codeProduit.timeGamme) / totalHours) * 100;
        rendementSum += rendement;
        rendementCount++;
      }
    }
    const rendementMoyen = rendementCount > 0 ? Math.round((rendementSum / rendementCount) * 10) / 10 : 0;

    // Activity: tasks completed by week (last 8 weeks)
    const weeks = last8Weeks();
    const tasksCompletedByWeek = await Promise.all(
      weeks.map(async (w) => ({
        week: w.label,
        completed: await this.prisma.task.count({
          where: {
            deletedAt: null,
            status: { in: ['terminee', 'livree'] },
            updatedAt: { gte: w.start, lte: w.end },
          },
        }),
      })),
    );

    const emis = Number(invoicesEmises._sum.totalHt ?? 0);
    const encaisse = Number(invoicesEncaissees._sum.totalHt ?? 0);

    return {
      clients: { total: clientsTotal, nouveauxCeMois: clientsNew },
      projects: { total: projectsTotal, enCours: projectsEnCours, termines: projectsTermines },
      tasks: { total: tasksTotal, enCours: tasksEnCours, terminees: tasksTerminees, enRetard: tasksEnRetard },
      employees: { total: employeesTotal, enConge: employeesEnConge, actifs: employeesTotal - employeesEnConge },
      revenue: { factureEmisHT: emis, encaisse, enAttente: emis - encaisse },
      rendementMoyen,
      tasksByStatus: tasksByStatusRaw.map((r) => ({ status: r.status, count: r._count.id })),
      projectsByStatus: projectsByStatusRaw.map((r) => ({ status: r.status, count: r._count.id })),
      tasksCompletedByWeek,
    };
  }

  // ─── Production ───────────────────────────────────────────────────────────

  async getProduction(dto: ProductionQueryDto): Promise<ProductionDashboard> {
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() - 90);

    const startDate = dto.startDate ?? defaultStart;
    const endDate = dto.endDate ?? now;

    const taskWhere: Record<string, unknown> = {
      deletedAt: null,
      createdAt: { gte: startDate, lte: endDate },
    };
    if (dto.operatorId) {
      taskWhere['project'] = { operatorId: dto.operatorId };
    }
    if (dto.clientId) {
      taskWhere['project'] = { ...(taskWhere['project'] as object ?? {}), clientId: dto.clientId };
    }

    const [tasksByStatusRaw, tasksOverdue] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: taskWhere,
        _count: { id: true },
      }),
      this.prisma.task.count({
        where: {
          ...taskWhere,
          status: { notIn: ['terminee', 'livree', 'annulee'] },
          plannedEndDate: { lt: now },
        },
      }),
    ]);

    // Tasks completed on time
    const completedTasks = await this.prisma.task.findMany({
      where: {
        ...taskWhere,
        status: { in: ['terminee', 'livree'] },
        actualEndDate: { not: null },
        plannedEndDate: { not: null },
      },
      select: { actualEndDate: true, plannedEndDate: true },
    });
    const tasksCompletedOnTime = completedTasks.filter(
      (t) => t.actualEndDate && t.plannedEndDate && t.actualEndDate <= t.plannedEndDate,
    ).length;

    // Rendement par opérateur
    const operators = await this.prisma.operator.findMany({
      where: dto.operatorId ? { id: dto.operatorId } : undefined,
      select: { id: true, name: true },
    });

    const rendementParOperateur = await Promise.all(
      operators.map(async (op) => {
        const tasks = await this.prisma.task.findMany({
          where: {
            deletedAt: null,
            project: { operatorId: op.id },
            createdAt: { gte: startDate, lte: endDate },
            timeEntries: { some: {} },
          },
          include: {
            codeProduit: { select: { timeGamme: true } },
            timeEntries: { select: { hours: true } },
          },
        });
        let rSum = 0;
        let rCount = 0;
        for (const t of tasks) {
          const h = t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
          if (h > 0 && t.codeProduit?.timeGamme) {
            rSum += (Number(t.codeProduit.timeGamme) / h) * 100;
            rCount++;
          }
        }
        return {
          operatorId: op.id,
          operatorName: op.name,
          rendement: rCount > 0 ? Math.round((rSum / rCount) * 10) / 10 : 0,
        };
      }),
    );

    // Délai R→L moyen
    const holidays = await this.prisma.publicHoliday.findMany({
      where: { country: 'FR', date: { gte: startDate, lte: endDate } },
      select: { date: true },
    });
    const holidayDates = holidays.map((h) => h.date);

    const finishedTasks = await this.prisma.task.findMany({
      where: {
        ...taskWhere,
        status: { in: ['terminee', 'livree'] },
        dateReception: { not: null },
        actualEndDate: { not: null },
      },
      select: { dateReception: true, actualEndDate: true },
    });

    let delaiSum = 0;
    let delaiCount = 0;
    for (const t of finishedTasks) {
      if (t.dateReception && t.actualEndDate) {
        const days = countBusinessDays(t.dateReception, t.actualEndDate, holidayDates);
        delaiSum += days;
        delaiCount++;
      }
    }
    const delaiRLMoyen = delaiCount > 0 ? Math.round((delaiSum / delaiCount) * 10) / 10 : 0;

    // Production by week (last 8 weeks within range)
    const weeks = last8Weeks();
    const productionByWeek = await Promise.all(
      weeks.map(async (w) => ({
        week: w.label,
        completed: await this.prisma.task.count({
          where: { ...taskWhere, status: { in: ['terminee', 'livree'] }, updatedAt: { gte: w.start, lte: w.end } },
        }),
        started: await this.prisma.task.count({
          where: { ...taskWhere, createdAt: { gte: w.start, lte: w.end } },
        }),
      })),
    );

    // Top codes produits
    const topCodesRaw = await this.prisma.task.groupBy({
      by: ['codeProduitId'],
      where: { ...taskWhere, codeProduitId: { not: undefined } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topCodes = await Promise.all(
      topCodesRaw.map(async (row) => {
        const cp = await this.prisma.codeProduit.findUnique({
          where: { id: row.codeProduitId },
          select: { code: true, timeGamme: true },
        });
        const tasks2 = await this.prisma.task.findMany({
          where: { ...taskWhere, codeProduitId: row.codeProduitId },
          include: { timeEntries: { select: { hours: true } } },
        });
        let rSum2 = 0;
        let rCnt2 = 0;
        for (const t of tasks2) {
          const h = t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
          if (h > 0 && cp?.timeGamme) {
            rSum2 += (Number(cp.timeGamme) / h) * 100;
            rCnt2++;
          }
        }
        return {
          codeProduit: cp?.code ?? row.codeProduitId,
          count: row._count.id,
          rendementMoyen: rCnt2 > 0 ? Math.round((rSum2 / rCnt2) * 10) / 10 : 0,
        };
      }),
    );

    return {
      tasksByStatus: tasksByStatusRaw.map((r) => ({ status: r.status, count: r._count.id })),
      rendementParOperateur: rendementParOperateur.sort((a, b) => b.rendement - a.rendement),
      delaiRLMoyen,
      tasksOverdue,
      tasksCompletedOnTime,
      productionByWeek,
      topCodes,
    };
  }

  // ─── Financier ────────────────────────────────────────────────────────────

  async getFinancier(dto: FinancierQueryDto): Promise<FinancierDashboard> {
    const now = new Date();
    const year = dto.year ?? now.getFullYear();
    const month = dto.month ?? now.getMonth() + 1;
    const { start, end } = getMonthBounds(year, month);

    const [caHT, caTTC, achatsHT, invoicesByStatusRaw, overdueInvoices] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { totalHt: true },
      }),
      this.prisma.invoice.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { totalTtc: true },
      }),
      this.prisma.purchaseInvoice.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { totalHt: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lte: end } },
        _count: { id: true },
        _sum: { totalHt: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          status: { notIn: ['payee', 'annulee'] },
          dueDate: { lt: now },
        },
        include: { client: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
    ]);

    // Revenue by month (last 12 months)
    const revenueByMonth: { month: string; CA: number; achats: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const { start: ms, end: me } = getMonthBounds(d.getFullYear(), d.getMonth() + 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

      const [ca, achat] = await Promise.all([
        this.prisma.invoice.aggregate({
          where: { createdAt: { gte: ms, lte: me } },
          _sum: { totalHt: true },
        }),
        this.prisma.purchaseInvoice.aggregate({
          where: { createdAt: { gte: ms, lte: me } },
          _sum: { totalHt: true },
        }),
      ]);
      revenueByMonth.push({
        month: label,
        CA: Number(ca._sum.totalHt ?? 0),
        achats: Number(achat._sum.totalHt ?? 0),
      });
    }

    // Top clients by revenue (current month)
    const topClientsRaw = await this.prisma.invoice.groupBy({
      by: ['clientId'],
      where: { createdAt: { gte: start, lte: end } },
      _sum: { totalHt: true },
      orderBy: { _sum: { totalHt: 'desc' } },
      take: 5,
    });

    const topClients = await Promise.all(
      topClientsRaw.map(async (row) => {
        const client = await this.prisma.client.findUnique({
          where: { id: row.clientId },
          select: { name: true },
        });
        return {
          clientId: row.clientId,
          clientName: client?.name ?? row.clientId,
          totalHT: Number(row._sum.totalHt ?? 0),
        };
      }),
    );

    const ht = Number(caHT._sum.totalHt ?? 0);
    const ttc = Number(caTTC._sum.totalTtc ?? 0);
    const achats = Number(achatsHT._sum.totalHt ?? 0);

    return {
      chiffreAffaireHT: ht,
      chiffreAffaireTTC: ttc,
      totalAchatsHT: achats,
      margeGrossiere: ht - achats,
      invoicesByStatus: invoicesByStatusRaw.map((r) => ({
        status: r.status,
        count: r._count.id,
        total: Number(r._sum.totalHt ?? 0),
      })),
      revenueByMonth,
      topClients,
      pendingInvoices: overdueInvoices.map((inv) => ({
        id: inv.id,
        clientName: inv.client?.name ?? 'N/A',
        amount: Number(inv.totalHt),
        dueDate: inv.dueDate?.toISOString() ?? '',
      })),
    };
  }

  // ─── Client ───────────────────────────────────────────────────────────────

  async getClient(clientId: string): Promise<ClientDashboard> {
    const now = new Date();

    const [
      projectsTotal,
      projectsEnCours,
      projectsTermines,
      tasksTotal,
      tasksEnCours,
      tasksTerminees,
      tasksEnRetard,
      sitesTotal,
      tasksByStatusRaw,
      recentTasks,
      lastTask,
    ] = await Promise.all([
      this.prisma.project.count({ where: { clientId, deletedAt: null } }),
      this.prisma.project.count({ where: { clientId, deletedAt: null, status: { in: ['en_cours', 'en_revision'] } } }),
      this.prisma.project.count({ where: { clientId, deletedAt: null, status: { in: ['terminee', 'livree'] } } }),
      this.prisma.task.count({ where: { deletedAt: null, project: { clientId } } }),
      this.prisma.task.count({ where: { deletedAt: null, project: { clientId }, status: { in: ['en_cours', 'en_revision'] } } }),
      this.prisma.task.count({ where: { deletedAt: null, project: { clientId }, status: { in: ['terminee', 'livree'] } } }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          project: { clientId },
          status: { notIn: ['terminee', 'livree', 'annulee'] },
          plannedEndDate: { lt: now },
        },
      }),
      this.prisma.site.count({ where: { clientId, deletedAt: null } }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { deletedAt: null, project: { clientId } },
        _count: { id: true },
      }),
      this.prisma.task.findMany({
        where: { deletedAt: null, project: { clientId } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      this.prisma.task.findFirst({
        where: { deletedAt: null, project: { clientId } },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    return {
      projects: { total: projectsTotal, enCours: projectsEnCours, termines: projectsTermines },
      tasks: { total: tasksTotal, enCours: tasksEnCours, terminees: tasksTerminees, enRetard: tasksEnRetard },
      sites: { total: sitesTotal },
      lastActivity: lastTask?.updatedAt?.toISOString() ?? null,
      tasksByStatus: tasksByStatusRaw.map((r) => ({ status: r.status, count: r._count.id })),
      recentTasks: recentTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  }

  // ─── Employé ──────────────────────────────────────────────────────────────

  async getEmployee(employeeId: string): Promise<EmployeeDashboard> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      tasksAssigned,
      tasksCompleted,
      tasksByStatusRaw,
      hoursAgg,
      upcomingLeaves,
    ] = await Promise.all([
      this.prisma.task.count({ where: { deletedAt: null, employeeId } }),
      this.prisma.task.count({ where: { deletedAt: null, employeeId, status: { in: ['terminee', 'livree'] } } }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { deletedAt: null, employeeId },
        _count: { id: true },
      }),
      this.prisma.timeEntry.aggregate({
        where: { employeeId, date: { gte: monthStart, lte: monthEnd } },
        _sum: { hours: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'approuve',
          startDate: { gte: now },
        },
        orderBy: { startDate: 'asc' },
        take: 5,
        include: { leaveType: { select: { name: true } } },
      }),
    ]);

    // Congés restants: sum of approved leave days this year
    const approvedDays = await this.prisma.leaveRequest.aggregate({
      where: {
        employeeId,
        status: 'approuve',
        startDate: { gte: new Date(now.getFullYear(), 0, 1) },
        endDate: { lte: new Date(now.getFullYear(), 11, 31) },
      },
      _sum: { days: true },
    });
    const defaultDaysPerYear = 25; // standard French paid leave
    const congesRestants = defaultDaysPerYear - Number(approvedDays._sum.days ?? 0);

    // Rendement moyen for employee
    const tasksWithTime = await this.prisma.task.findMany({
      where: { deletedAt: null, employeeId, timeEntries: { some: {} } },
      include: {
        codeProduit: { select: { timeGamme: true } },
        timeEntries: { where: { employeeId }, select: { hours: true } },
      },
    });
    let rSum = 0;
    let rCount = 0;
    for (const t of tasksWithTime) {
      const h = t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
      if (h > 0 && t.codeProduit?.timeGamme) {
        rSum += (Number(t.codeProduit.timeGamme) / h) * 100;
        rCount++;
      }
    }
    const rendementMoyen = rCount > 0 ? Math.round((rSum / rCount) * 10) / 10 : 0;

    // Rendement par semaine (last 8 weeks)
    const weeks = last8Weeks();
    const rendementByWeek = await Promise.all(
      weeks.map(async (w) => {
        const weekTasks = await this.prisma.task.findMany({
          where: {
            deletedAt: null,
            employeeId,
            updatedAt: { gte: w.start, lte: w.end },
            timeEntries: { some: {} },
          },
          include: {
            codeProduit: { select: { timeGamme: true } },
            timeEntries: { where: { employeeId }, select: { hours: true } },
          },
        });
        let ws = 0;
        let wc = 0;
        for (const t of weekTasks) {
          const h = t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
          if (h > 0 && t.codeProduit?.timeGamme) {
            ws += (Number(t.codeProduit.timeGamme) / h) * 100;
            wc++;
          }
        }
        return { week: w.label, rendement: wc > 0 ? Math.round((ws / wc) * 10) / 10 : 0 };
      }),
    );

    return {
      tasksAssigned,
      tasksCompleted,
      rendementMoyen,
      hoursLogged: Number(hoursAgg._sum.hours ?? 0),
      congesRestants: Math.max(0, congesRestants),
      tasksByStatus: tasksByStatusRaw.map((r) => ({ status: r.status, count: r._count.id })),
      rendementByWeek,
      upcomingLeaves: upcomingLeaves.map((l) => ({
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        type: l.leaveType?.name ?? 'Congé',
      })),
    };
  }

  // ─── Rentabilité Salariale ─────────────────────────────────────────────────

  async getRentabilite(year?: number, month?: number): Promise<RentabiliteDashboard> {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const { start, end } = getMonthBounds(y, m);
    const workingHoursPerMonth = 151.67; // standard French full-time monthly hours
    const defaultChargesRate = 0.42;

    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        grossSalary: true,
      },
    });

    const employeeData = await Promise.all(
      employees.map(async (emp) => {
        const salaireCharge =
          Number(emp.grossSalary ?? 0) * (1 + defaultChargesRate);

        // Revenue generated: sum totalHt of invoices linked to projects
        // where employee worked on tasks with time entries in the period
        const hoursAgg = await this.prisma.timeEntry.aggregate({
          where: { employeeId: emp.id, date: { gte: start, lte: end } },
          _sum: { hours: true },
        });
        const hoursLogged = Number(hoursAgg._sum.hours ?? 0);

        // Revenue: sum of facturable task invoice lines via codeProduit link
        const facturableTasks = await this.prisma.task.findMany({
          where: {
            deletedAt: null,
            employeeId: emp.id,
            facturable: true,
            timeEntries: {
              some: { date: { gte: start, lte: end } },
            },
          },
          select: {
            codeProduitId: true,
            timeEntries: {
              where: { employeeId: emp.id, date: { gte: start, lte: end } },
              select: { hours: true },
            },
            codeProduit: { select: { unitPrice: true } },
          },
        });

        // Approximate revenue = hours * hourly rate (unitPrice as proxy)
        let revenueGenere = 0;
        for (const task of facturableTasks) {
          const taskHours = task.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
          if (task.codeProduit?.unitPrice) {
            revenueGenere += taskHours * Number(task.codeProduit.unitPrice);
          }
        }

        const tauxOccupation =
          workingHoursPerMonth > 0
            ? Math.round((hoursLogged / workingHoursPerMonth) * 1000) / 10
            : 0;

        const ratio =
          salaireCharge > 0
            ? Math.round((revenueGenere / salaireCharge) * 100) / 100
            : 0;

        return {
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          salaireCharge: Math.round(salaireCharge * 100) / 100,
          revenueGenere: Math.round(revenueGenere * 100) / 100,
          ratio,
          hoursLogged,
          tauxOccupation,
        };
      }),
    );

    const masseSalariale = employeeData.reduce((s, e) => s + e.salaireCharge, 0);
    const revenueTotal = employeeData.reduce((s, e) => s + e.revenueGenere, 0);
    const ratioGlobal =
      masseSalariale > 0 ? Math.round((revenueTotal / masseSalariale) * 100) / 100 : 0;

    return {
      employees: employeeData,
      totals: {
        masseSalariale: Math.round(masseSalariale * 100) / 100,
        revenueTotal: Math.round(revenueTotal * 100) / 100,
        ratioGlobal,
      },
    };
  }
}

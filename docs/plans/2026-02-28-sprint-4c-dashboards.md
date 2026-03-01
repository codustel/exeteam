# ExeTeam Sprint 4C — Dashboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all dashboard pages — NestJS API (`DashboardModule`) + Next.js UI — covering the General, Production, Financial, Client, Employee, and Payroll Profitability dashboards. Each dashboard is backed by aggregated Prisma queries and rendered with Recharts charts, shadcn/ui components, and TanStack Query. Excel export is streamed from NestJS using ExcelJS.

**Architecture:** NestJS `DashboardModule` exposes six data endpoints plus one export endpoint. All aggregation runs server-side via Prisma. The Next.js layer has six route pages under `(dashboard)/dashboards/`, shared dashboard components (`KPICard`, `ChartCard`, `DateRangePicker`, `ExportButton`, `DashboardLayout`), and a single `dashboardApi` helper. Shared TypeScript types live in `packages/shared/src/dashboard.ts`.

**Tech Stack:** NestJS · Prisma · Zod pipes · Recharts · ExcelJS · shadcn/ui · TanStack Query

**Branch:** `feat/dashboards`

**Prerequisite:** Sprint 2A (clients), Sprint 2B (sites), Sprint 2C (custom fields/codes produits), Sprint 2D (employees/leaves), Sprint 3A (projects/tasks/time-entries), Sprint 3C (commercial: invoices/attachments), Sprint 4A (accounting/imports) all complete.

---

## Task 1: Create branch `feat/dashboards`

```bash
git checkout main && git pull origin main
git checkout -b feat/dashboards
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/dashboards branch"
```

---

## Task 2: Install Recharts and ExcelJS

```bash
cd apps/web && pnpm add recharts
cd apps/web && pnpm add -D @types/recharts
cd apps/api && pnpm add exceljs
```

**Commit:**
```bash
git add apps/web/package.json apps/api/package.json pnpm-lock.yaml
git commit -m "chore: add recharts to web and exceljs to api"
```

---

## Task 3: Shared dashboard types in `packages/shared`

**File to create:** `packages/shared/src/dashboard.ts`

```typescript
// packages/shared/src/dashboard.ts

export interface GeneralDashboard {
  clients: { total: number; nouveauxCeMois: number };
  projects: { total: number; enCours: number; termines: number };
  tasks: { total: number; enCours: number; terminees: number; enRetard: number };
  employees: { total: number; enConge: number; actifs: number };
  revenue: { factureEmisHT: number; encaisse: number; enAttente: number };
  rendementMoyen: number;
  tasksByStatus: { status: string; count: number }[];
  projectsByStatus: { status: string; count: number }[];
  tasksCompletedByWeek: { week: string; completed: number }[];
}

export interface ProductionDashboard {
  tasksByStatus: { status: string; count: number }[];
  rendementParOperateur: {
    operatorId: string;
    operatorName: string;
    rendement: number;
  }[];
  delaiRLMoyen: number;
  tasksOverdue: number;
  tasksCompletedOnTime: number;
  productionByWeek: { week: string; completed: number; started: number }[];
  topCodes: { codeProduit: string; count: number; rendementMoyen: number }[];
}

export interface FinancierDashboard {
  chiffreAffaireHT: number;
  chiffreAffaireTTC: number;
  totalAchatsHT: number;
  margeGrossiere: number;
  invoicesByStatus: { status: string; count: number; total: number }[];
  revenueByMonth: { month: string; CA: number; achats: number }[];
  topClients: { clientId: string; clientName: string; totalHT: number }[];
  pendingInvoices: {
    id: string;
    clientName: string;
    amount: number;
    dueDate: string;
  }[];
}

export interface ClientDashboard {
  projects: { total: number; enCours: number; termines: number };
  tasks: { total: number; enCours: number; terminees: number; enRetard: number };
  sites: { total: number };
  lastActivity: string | null;
  tasksByStatus: { status: string; count: number }[];
  recentTasks: {
    id: string;
    title: string;
    status: string;
    updatedAt: string;
  }[];
}

export interface EmployeeDashboard {
  tasksAssigned: number;
  tasksCompleted: number;
  rendementMoyen: number;
  hoursLogged: number;
  congesRestants: number;
  tasksByStatus: { status: string; count: number }[];
  rendementByWeek: { week: string; rendement: number }[];
  upcomingLeaves: { startDate: string; endDate: string; type: string }[];
}

export interface RentabiliteEmployee {
  employeeId: string;
  employeeName: string;
  salaireCharge: number;
  revenueGenere: number;
  ratio: number;
  hoursLogged: number;
  tauxOccupation: number;
}

export interface RentabiliteDashboard {
  employees: RentabiliteEmployee[];
  totals: {
    masseSalariale: number;
    revenueTotal: number;
    ratioGlobal: number;
  };
}

export type DashboardExportType =
  | 'general'
  | 'production'
  | 'financier'
  | 'rentabilite';
```

**Also edit** `packages/shared/src/index.ts` to export the new file:

```typescript
export * from './enums';
export * from './types';
export * from './types/custom-fields';
export * from './dashboard';
```

**Commit:**
```bash
git add packages/shared/src/dashboard.ts packages/shared/src/index.ts
git commit -m "feat(shared): add dashboard TypeScript types"
```

---

## Task 4: NestJS DashboardModule — DTO

**Files to create:**
- `apps/api/src/dashboard/dto/production-query.dto.ts`
- `apps/api/src/dashboard/dto/financier-query.dto.ts`
- `apps/api/src/dashboard/dto/export-query.dto.ts`

### Step 1: `apps/api/src/dashboard/dto/production-query.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ProductionQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  operatorId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

export class ProductionQueryDto extends createZodDto(ProductionQuerySchema) {}
```

### Step 2: `apps/api/src/dashboard/dto/financier-query.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const FinancierQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export class FinancierQueryDto extends createZodDto(FinancierQuerySchema) {}
```

### Step 3: `apps/api/src/dashboard/dto/export-query.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ExportQuerySchema = z.object({
  type: z.enum(['general', 'production', 'financier', 'rentabilite']),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  format: z.literal('xlsx').default('xlsx'),
});

export class ExportQueryDto extends createZodDto(ExportQuerySchema) {}
```

**Commit:**
```bash
git add apps/api/src/dashboard/dto
git commit -m "feat(api): add DashboardModule DTOs"
```

---

## Task 5: NestJS DashboardService

**File to create:** `apps/api/src/dashboard/dashboard.service.ts`

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductionQueryDto } from './dto/production-query.dto';
import { FinancierQueryDto } from './dto/financier-query.dto';
import {
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
      this.prisma.leave.count({
        where: {
          status: 'approuve',
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
      this.prisma.invoice.aggregate({
        where: { deletedAt: null, createdAt: { gte: monthStart, lte: monthEnd } },
        _sum: { totalHT: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          deletedAt: null,
          status: 'payee',
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { totalHT: true },
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
        _count: { select: { timeEntries: true } },
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

    const emis = Number(invoicesEmises._sum.totalHT ?? 0);
    const encaisse = Number(invoicesEncaissees._sum.totalHT ?? 0);

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

    const [tasksByStatusRaw, tasksOverdue, tasksCompletedOnTime] = await Promise.all([
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
      this.prisma.task.count({
        where: {
          ...taskWhere,
          status: { in: ['terminee', 'livree'] },
          actualEndDate: { lte: this.prisma.task.fields.plannedEndDate as unknown as Date },
        },
      }).catch(() => 0),
    ]);

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
      where: { ...taskWhere, codeProduitId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topCodes = await Promise.all(
      topCodesRaw.map(async (row) => {
        const cp = await this.prisma.codeProduit.findUnique({
          where: { id: row.codeProduitId! },
          select: { code: true, timeGamme: true },
        });
        const tasks2 = await this.prisma.task.findMany({
          where: { ...taskWhere, codeProduitId: row.codeProduitId! },
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
          codeProduit: cp?.code ?? row.codeProduitId!,
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
        where: { deletedAt: null, createdAt: { gte: start, lte: end } },
        _sum: { totalHT: true },
      }),
      this.prisma.invoice.aggregate({
        where: { deletedAt: null, createdAt: { gte: start, lte: end } },
        _sum: { totalTTC: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { deletedAt: null, createdAt: { gte: start, lte: end } },
        _sum: { totalHT: true },
      }).catch(() => ({ _sum: { totalHT: 0 } })),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { deletedAt: null, createdAt: { gte: start, lte: end } },
        _count: { id: true },
        _sum: { totalHT: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
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
          where: { deletedAt: null, createdAt: { gte: ms, lte: me } },
          _sum: { totalHT: true },
        }),
        this.prisma.purchaseOrder.aggregate({
          where: { deletedAt: null, createdAt: { gte: ms, lte: me } },
          _sum: { totalHT: true },
        }).catch(() => ({ _sum: { totalHT: 0 } })),
      ]);
      revenueByMonth.push({
        month: label,
        CA: Number(ca._sum.totalHT ?? 0),
        achats: Number(achat._sum.totalHT ?? 0),
      });
    }

    // Top clients by revenue (current month)
    const topClientsRaw = await this.prisma.invoice.groupBy({
      by: ['clientId'],
      where: { deletedAt: null, createdAt: { gte: start, lte: end } },
      _sum: { totalHT: true },
      orderBy: { _sum: { totalHT: 'desc' } },
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
          totalHT: Number(row._sum.totalHT ?? 0),
        };
      }),
    );

    const ht = Number(caHT._sum.totalHT ?? 0);
    const ttc = Number(caTTC._sum.totalTTC ?? 0);
    const achats = Number(achatsHT._sum.totalHT ?? 0);

    return {
      chiffreAffaireHT: ht,
      chiffreAffaireTTC: ttc,
      totalAchatsHT: achats,
      margeGrossiere: ht - achats,
      invoicesByStatus: invoicesByStatusRaw.map((r) => ({
        status: r.status,
        count: r._count.id,
        total: Number(r._sum.totalHT ?? 0),
      })),
      revenueByMonth,
      topClients,
      pendingInvoices: overdueInvoices.map((inv) => ({
        id: inv.id,
        clientName: (inv as Record<string, unknown>)['client'] ? ((inv as Record<string, unknown>)['client'] as Record<string, unknown>)['name'] as string : 'N/A',
        amount: Number(inv.totalHT),
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
      congesRestants,
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
      this.prisma.leaveBalance.aggregate({
        where: { employeeId, year: now.getFullYear() },
        _sum: { remaining: true },
      }).catch(() => ({ _sum: { remaining: 0 } })),
      this.prisma.leave.findMany({
        where: {
          employeeId,
          status: 'approuve',
          startDate: { gte: now },
        },
        orderBy: { startDate: 'asc' },
        take: 5,
        select: { startDate: true, endDate: true, type: true },
      }),
    ]);

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
      congesRestants: Number((congesRestants._sum as Record<string, unknown>)['remaining'] ?? 0),
      tasksByStatus: tasksByStatusRaw.map((r) => ({ status: r.status, count: r._count.id })),
      rendementByWeek,
      upcomingLeaves: upcomingLeaves.map((l) => ({
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        type: l.type,
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

    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        grossSalary: true,
        chargesRate: true,
      },
    });

    const employeeData = await Promise.all(
      employees.map(async (emp) => {
        const salaireCharge =
          Number(emp.grossSalary ?? 0) * (1 + Number(emp.chargesRate ?? 0.42));

        // Revenue generated: sum of facturable invoice lines linked to tasks assigned to this employee
        const revenueAgg = await this.prisma.invoiceLine.aggregate({
          where: {
            invoice: {
              deletedAt: null,
              createdAt: { gte: start, lte: end },
            },
            task: { employeeId: emp.id, facturable: true },
          },
          _sum: { totalHT: true },
        }).catch(() => ({ _sum: { totalHT: 0 } }));
        const revenueGenere = Number((revenueAgg._sum as Record<string, unknown>)['totalHT'] ?? 0);

        const hoursAgg = await this.prisma.timeEntry.aggregate({
          where: { employeeId: emp.id, date: { gte: start, lte: end } },
          _sum: { hours: true },
        });
        const hoursLogged = Number(hoursAgg._sum.hours ?? 0);
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
```

**Commit:**
```bash
git add apps/api/src/dashboard/dashboard.service.ts
git commit -m "feat(api): add DashboardService with all 5 data aggregation methods"
```

---

## Task 6: NestJS DashboardController + Excel Export

**File to create:** `apps/api/src/dashboard/dashboard.controller.ts`

```typescript
import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { DashboardService } from './dashboard.service';
import { ProductionQueryDto } from './dto/production-query.dto';
import { FinancierQueryDto } from './dto/financier-query.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import type { AuthUser } from '../auth/supabase.strategy';

interface RequestWithUser {
  user: AuthUser;
}

const RESTRICTED_ROLES = new Set(['gerant', 'comptable', 'super_admin']);

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('general')
  @RequirePermissions('dashboard.read')
  getGeneral() {
    return this.dashboardService.getGeneral();
  }

  @Get('production')
  @RequirePermissions('dashboard.read')
  getProduction(@Query() dto: ProductionQueryDto) {
    return this.dashboardService.getProduction(dto);
  }

  @Get('financier')
  @RequirePermissions('dashboard.read')
  async getFinancier(@Query() dto: FinancierQueryDto, @Req() req: RequestWithUser) {
    if (!RESTRICTED_ROLES.has(req.user.role)) {
      throw new ForbiddenException('Accès réservé au gérant et au comptable.');
    }
    return this.dashboardService.getFinancier(dto);
  }

  @Get('client/:clientId')
  @RequirePermissions('dashboard.read')
  getClient(@Param('clientId') clientId: string) {
    return this.dashboardService.getClient(clientId);
  }

  @Get('employe/:employeeId')
  @RequirePermissions('dashboard.read')
  getEmployee(@Param('employeeId') employeeId: string) {
    return this.dashboardService.getEmployee(employeeId);
  }

  @Get('rentabilite-salariale')
  @RequirePermissions('dashboard.read')
  async getRentabilite(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Req() req?: RequestWithUser,
  ) {
    if (req && !RESTRICTED_ROLES.has(req.user.role)) {
      throw new ForbiddenException('Accès réservé au gérant et au comptable.');
    }
    return this.dashboardService.getRentabilite(
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @Get('export')
  @RequirePermissions('dashboard.read')
  async export(
    @Query() dto: ExportQueryDto,
    @Res() res: Response,
    @Req() req: RequestWithUser,
  ) {
    if (
      (dto.type === 'financier' || dto.type === 'rentabilite') &&
      !RESTRICTED_ROLES.has(req.user.role)
    ) {
      throw new ForbiddenException('Export réservé au gérant et au comptable.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ExeTeam';
    workbook.created = new Date();

    if (dto.type === 'general') {
      const data = await this.dashboardService.getGeneral();
      const sheet = workbook.addWorksheet('Dashboard Général');
      sheet.columns = [
        { header: 'Indicateur', key: 'label', width: 30 },
        { header: 'Valeur', key: 'value', width: 20 },
      ];
      sheet.addRows([
        { label: 'Clients total', value: data.clients.total },
        { label: 'Clients nouveaux ce mois', value: data.clients.nouveauxCeMois },
        { label: 'Projets total', value: data.projects.total },
        { label: 'Projets en cours', value: data.projects.enCours },
        { label: 'Projets terminés', value: data.projects.termines },
        { label: 'Tâches total', value: data.tasks.total },
        { label: 'Tâches en cours', value: data.tasks.enCours },
        { label: 'Tâches terminées', value: data.tasks.terminees },
        { label: 'Tâches en retard', value: data.tasks.enRetard },
        { label: 'Employés actifs', value: data.employees.actifs },
        { label: 'Employés en congé', value: data.employees.enConge },
        { label: 'CA HT émis (mois)', value: data.revenue.factureEmisHT },
        { label: 'CA encaissé (mois)', value: data.revenue.encaisse },
        { label: 'CA en attente (mois)', value: data.revenue.enAttente },
        { label: 'Rendement moyen (%)', value: data.rendementMoyen },
      ]);
      const statusSheet = workbook.addWorksheet('Tâches par statut');
      statusSheet.columns = [
        { header: 'Statut', key: 'status', width: 20 },
        { header: 'Nombre', key: 'count', width: 15 },
      ];
      statusSheet.addRows(data.tasksByStatus);
    }

    if (dto.type === 'production') {
      const data = await this.dashboardService.getProduction({
        startDate: dto.startDate,
        endDate: dto.endDate,
      });
      const sheet = workbook.addWorksheet('Production');
      sheet.columns = [
        { header: 'Indicateur', key: 'label', width: 35 },
        { header: 'Valeur', key: 'value', width: 20 },
      ];
      sheet.addRows([
        { label: 'Tâches en retard', value: data.tasksOverdue },
        { label: 'Tâches terminées dans les délais', value: data.tasksCompletedOnTime },
        { label: 'Délai R→L moyen (jours ouvrés)', value: data.delaiRLMoyen },
      ]);
      const rendSheet = workbook.addWorksheet('Rendement opérateurs');
      rendSheet.columns = [
        { header: 'Opérateur', key: 'operatorName', width: 30 },
        { header: 'Rendement (%)', key: 'rendement', width: 15 },
      ];
      rendSheet.addRows(data.rendementParOperateur);
      const codesSheet = workbook.addWorksheet('Top codes produits');
      codesSheet.columns = [
        { header: 'Code produit', key: 'codeProduit', width: 20 },
        { header: 'Nb tâches', key: 'count', width: 12 },
        { header: 'Rendement moyen (%)', key: 'rendementMoyen', width: 20 },
      ];
      codesSheet.addRows(data.topCodes);
    }

    if (dto.type === 'financier') {
      const now = new Date();
      const data = await this.dashboardService.getFinancier({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      const sheet = workbook.addWorksheet('Financier');
      sheet.columns = [
        { header: 'Indicateur', key: 'label', width: 30 },
        { header: 'Valeur (€)', key: 'value', width: 20 },
      ];
      sheet.addRows([
        { label: 'CA HT', value: data.chiffreAffaireHT },
        { label: 'CA TTC', value: data.chiffreAffaireTTC },
        { label: 'Achats HT', value: data.totalAchatsHT },
        { label: 'Marge brute', value: data.margeGrossiere },
      ]);
      const pendingSheet = workbook.addWorksheet('Factures en retard');
      pendingSheet.columns = [
        { header: 'Client', key: 'clientName', width: 30 },
        { header: 'Montant (€)', key: 'amount', width: 15 },
        { header: 'Échéance', key: 'dueDate', width: 15 },
      ];
      pendingSheet.addRows(data.pendingInvoices);
    }

    if (dto.type === 'rentabilite') {
      const now = new Date();
      const data = await this.dashboardService.getRentabilite(
        now.getFullYear(),
        now.getMonth() + 1,
      );
      const sheet = workbook.addWorksheet('Rentabilité salariale');
      sheet.columns = [
        { header: 'Employé', key: 'employeeName', width: 30 },
        { header: 'Salaire chargé (€)', key: 'salaireCharge', width: 20 },
        { header: 'Revenu généré (€)', key: 'revenueGenere', width: 20 },
        { header: 'Ratio', key: 'ratio', width: 10 },
        { header: 'Heures', key: 'hoursLogged', width: 10 },
        { header: "Taux d'occupation (%)", key: 'tauxOccupation', width: 20 },
      ];
      sheet.addRows(data.employees);
      sheet.addRow({});
      sheet.addRow({
        employeeName: 'TOTAL',
        salaireCharge: data.totals.masseSalariale,
        revenueGenere: data.totals.revenueTotal,
        ratio: data.totals.ratioGlobal,
      });
    }

    const filename = `dashboard-${dto.type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
```

**Commit:**
```bash
git add apps/api/src/dashboard/dashboard.controller.ts
git commit -m "feat(api): add DashboardController with all endpoints and Excel export via ExcelJS"
```

---

## Task 7: NestJS DashboardModule + AppModule registration

### Step 1: `apps/api/src/dashboard/dashboard.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

### Step 2: Edit `apps/api/src/app.module.ts`

Add `DashboardModule` to the imports array. The complete updated file:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { SitesModule } from './sites/sites.module';
import { EmployeesModule } from './employees/employees.module';
import { LeavesModule } from './leaves/leaves.module';
import { PublicHolidaysModule } from './public-holidays/public-holidays.module';
import { CodesProduitsModule } from './codes-produits/codes-produits.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { DemandsModule } from './demands/demands.module';
import { CommercialModule } from './commercial/commercial.module';
import { AccountingModule } from './accounting/accounting.module';
import { MessagesModule } from './messages/messages.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    SitesModule,
    EmployeesModule,
    LeavesModule,
    PublicHolidaysModule,
    CodesProduitsModule,
    CustomFieldsModule,
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    DemandsModule,
    CommercialModule,
    AccountingModule,
    MessagesModule,
    DashboardModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**Commit:**
```bash
git add apps/api/src/dashboard/dashboard.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): register DashboardModule in AppModule"
```

---

## Task 8: Next.js API helper `apps/web/src/lib/api/dashboard.ts`

**File to create:** `apps/web/src/lib/api/dashboard.ts`

```typescript
import { apiRequest } from './client';
import type {
  GeneralDashboard,
  ProductionDashboard,
  FinancierDashboard,
  ClientDashboard,
  EmployeeDashboard,
  RentabiliteDashboard,
  DashboardExportType,
} from '@exeteam/shared';

export type { GeneralDashboard, ProductionDashboard, FinancierDashboard, ClientDashboard, EmployeeDashboard, RentabiliteDashboard };

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, String(value));
    }
  }
  return q.toString() ? `?${q.toString()}` : '';
}

export const dashboardApi = {
  getGeneral: () =>
    apiRequest<GeneralDashboard>('/dashboard/general'),

  getProduction: (params: {
    startDate?: string;
    endDate?: string;
    operatorId?: string;
    clientId?: string;
  } = {}) =>
    apiRequest<ProductionDashboard>(`/dashboard/production${toQuery(params)}`),

  getFinancier: (params: { year?: number; month?: number } = {}) =>
    apiRequest<FinancierDashboard>(`/dashboard/financier${toQuery(params)}`),

  getClient: (clientId: string) =>
    apiRequest<ClientDashboard>(`/dashboard/client/${clientId}`),

  getEmployee: (employeeId: string) =>
    apiRequest<EmployeeDashboard>(`/dashboard/employe/${employeeId}`),

  getRentabilite: (params: { year?: number; month?: number } = {}) =>
    apiRequest<RentabiliteDashboard>(`/dashboard/rentabilite-salariale${toQuery(params)}`),

  /**
   * Triggers an Excel download. Returns a Blob that must be used with a
   * dynamic <a> element to trigger the browser file download.
   */
  export: async (params: {
    type: DashboardExportType;
    startDate?: string;
    endDate?: string;
    format?: 'xlsx';
  }): Promise<Blob> => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const qs = toQuery({ ...params, format: 'xlsx' });

    const res = await fetch(`${API_URL}/dashboard/export${qs}`, {
      headers: {
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
      },
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
};
```

**Commit:**
```bash
git add apps/web/src/lib/api/dashboard.ts
git commit -m "feat(web): add dashboardApi typed helper with export blob support"
```

---

## Task 9: Shared dashboard components

**Files to create:**
- `apps/web/src/components/dashboard/KPICard.tsx`
- `apps/web/src/components/dashboard/ChartCard.tsx`
- `apps/web/src/components/dashboard/DateRangePicker.tsx`
- `apps/web/src/components/dashboard/ExportButton.tsx`
- `apps/web/src/components/dashboard/DashboardLayout.tsx`

### Step 1: `apps/web/src/components/dashboard/KPICard.tsx`

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: number; // % change, positive = up, negative = down
  trendLabel?: string;
  className?: string;
  valueClassName?: string;
}

export function KPICard({
  label,
  value,
  trend,
  trendLabel,
  className,
  valueClassName,
}: KPICardProps) {
  const hasTrend = trend !== undefined;
  const isUp = (trend ?? 0) > 0;
  const isDown = (trend ?? 0) < 0;

  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-5 pb-4 px-5">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', valueClassName)}>{value}</p>
        {hasTrend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs mt-2',
              isUp && 'text-green-600',
              isDown && 'text-red-500',
              !isUp && !isDown && 'text-muted-foreground',
            )}
          >
            {isUp && <TrendingUp className="h-3 w-3" />}
            {isDown && <TrendingDown className="h-3 w-3" />}
            {!isUp && !isDown && <Minus className="h-3 w-3" />}
            <span>
              {isUp ? '+' : ''}
              {trend?.toFixed(1)}%{trendLabel ? ` ${trendLabel}` : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 2: `apps/web/src/components/dashboard/ChartCard.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ChartCard({
  title,
  children,
  action,
  className,
  contentClassName,
}: ChartCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className={cn('', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
```

### Step 3: `apps/web/src/components/dashboard/DateRangePicker.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
}

export function DateRangePicker({ value, onChange, placeholder = 'Sélectionner une période' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const label =
    value?.from && value?.to
      ? `${format(value.from, 'd MMM yyyy', { locale: fr })} – ${format(value.to, 'd MMM yyyy', { locale: fr })}`
      : value?.from
      ? format(value.from, 'd MMM yyyy', { locale: fr })
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[220px] justify-start font-normal">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => {
            onChange(range);
            if (range?.from && range?.to) setOpen(false);
          }}
          numberOfMonths={2}
          locale={fr}
        />
        <div className="flex justify-end gap-2 p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onChange(undefined); setOpen(false); }}
          >
            Réinitialiser
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Step 4: `apps/web/src/components/dashboard/ExportButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { dashboardApi } from '@/lib/api/dashboard';
import type { DashboardExportType } from '@exeteam/shared';

interface ExportButtonProps {
  type: DashboardExportType;
  startDate?: string;
  endDate?: string;
  label?: string;
}

export function ExportButton({ type, startDate, endDate, label = 'Exporter Excel' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const blob = await dashboardApi.export({ type, startDate, endDate, format: 'xlsx' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-2">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
```

### Step 5: `apps/web/src/components/dashboard/DashboardLayout.tsx`

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Factory, Euro, User, Users, TrendingUp } from 'lucide-react';

const dashboardLinks = [
  { href: '/dashboards', label: 'Général', icon: LayoutDashboard, exact: true },
  { href: '/dashboards/production', label: 'Production', icon: Factory, exact: false },
  { href: '/dashboards/financier', label: 'Financier', icon: Euro, exact: false },
  { href: '/dashboards/rentabilite', label: 'Rentabilité', icon: TrendingUp, exact: false },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation */}
      <div className="border-b border-border bg-background px-6">
        <nav className="flex gap-1">
          {dashboardLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href) && !link.exact;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-[#FF6600] text-[#FF6600]'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* Page content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/dashboard
git commit -m "feat(web): add shared dashboard components (KPICard, ChartCard, DateRangePicker, ExportButton, DashboardLayout)"
```


---

## Task 10: Next.js layout for dashboards section

**File to create:** `apps/web/src/app/(app)/dashboards/layout.tsx`

```typescript
import { Header } from '@/components/layout/header';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

export default function DashboardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header title="Tableaux de bord" />
      <DashboardLayout>{children}</DashboardLayout>
    </>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/dashboards/layout.tsx
git commit -m "feat(web): add dashboards layout with sub-navigation"
```

---

## Task 11: Dashboard Général page

**Files to create:**
- `apps/web/src/app/(app)/dashboards/page.tsx`
- `apps/web/src/app/(app)/dashboards/general-client.tsx`

### Step 1: `apps/web/src/app/(app)/dashboards/page.tsx`

```typescript
import { GeneralClient } from './general-client';

export const metadata = { title: 'Dashboard Général' };

export default function DashboardGeneralPage() {
  return <GeneralClient />;
}
```

### Step 2: `apps/web/src/app/(app)/dashboards/general-client.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { Building2, FolderKanban, AlertTriangle, Users, Euro, TrendingUp } from 'lucide-react';

const TASK_STATUS_COLORS: Record<string, string> = {
  a_traiter: '#94a3b8',
  en_cours: '#3b82f6',
  en_revision: '#a855f7',
  terminee: '#22c55e',
  livree: '#10b981',
  annulee: '#ef4444',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

function formatEUR(value: number) {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function GeneralClient() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'general'],
    queryFn: () => dashboardApi.getGeneral(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">
        Chargement du tableau de bord...
      </div>
    );
  }

  const kpis = [
    {
      label: 'Clients',
      value: data.clients.total,
      icon: Building2,
    },
    {
      label: 'Projets en cours',
      value: data.projects.enCours,
      icon: FolderKanban,
    },
    {
      label: 'Tâches en retard',
      value: data.tasks.enRetard,
      icon: AlertTriangle,
      valueClassName: data.tasks.enRetard > 0 ? 'text-red-600' : undefined,
    },
    {
      label: 'Employés actifs',
      value: data.employees.actifs,
      icon: Users,
    },
    {
      label: 'CA mois (HT)',
      value: formatEUR(data.revenue.factureEmisHT),
      icon: Euro,
    },
    {
      label: 'Rendement moyen',
      value: `${data.rendementMoyen.toFixed(1)}%`,
      icon: TrendingUp,
    },
  ];

  const employeeDonut = [
    { name: 'Actifs', value: data.employees.actifs, fill: '#22c55e' },
    { name: 'En congé', value: data.employees.enConge, fill: '#f97316' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <KPICard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            valueClassName={kpi.valueClassName}
          />
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tâches par statut — Pie */}
        <ChartCard title="Tâches par statut">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data.tasksByStatus.map((d) => ({
                  name: TASK_STATUS_LABELS[d.status] ?? d.status,
                  value: d.count,
                  fill: TASK_STATUS_COLORS[d.status] ?? '#cbd5e1',
                }))}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.tasksByStatus.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={TASK_STATUS_COLORS[entry.status] ?? '#cbd5e1'}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, 'Tâches']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Projets par statut — Bar */}
        <ChartCard title="Projets par statut">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data.projectsByStatus.map((d) => ({
                name: PROJECT_STATUS_LABELS[d.status] ?? d.status,
                Projets: d.count,
              }))}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Projets" fill="#FF6600" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Employés — Donut */}
        <ChartCard title="Employés">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={employeeDonut}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {employeeDonut.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Activité — Line chart */}
        <ChartCard title="Tâches terminées (8 dernières semaines)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data.tasksCompletedByWeek}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completed"
                name="Terminées"
                stroke="#FF6600"
                strokeWidth={2}
                dot={{ r: 3, fill: '#FF6600' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/dashboards/page.tsx apps/web/src/app/\(app\)/dashboards/general-client.tsx
git commit -m "feat(web): add Dashboard Général page with 6 KPIs and 4 Recharts charts"
```

---

## Task 12: Dashboard Production page

**Files to create:**
- `apps/web/src/app/(app)/dashboards/production/page.tsx`
- `apps/web/src/app/(app)/dashboards/production/production-client.tsx`

### Step 1: `apps/web/src/app/(app)/dashboards/production/page.tsx`

```typescript
import { ProductionClient } from './production-client';

export const metadata = { title: 'Dashboard Production' };

export default function DashboardProductionPage() {
  return <ProductionClient />;
}
```

### Step 2: `apps/web/src/app/(app)/dashboards/production/production-client.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DateRange } from 'react-day-picker';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { ExportButton } from '@/components/dashboard/ExportButton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const TASK_STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

function rendementColor(r: number): string {
  if (r >= 90) return 'text-green-600 font-semibold';
  if (r >= 70) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
}

export function ProductionClient() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const startDate = dateRange?.from?.toISOString().slice(0, 10);
  const endDate = dateRange?.to?.toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'production', { startDate, endDate }],
    queryFn: () => dashboardApi.getProduction({ startDate, endDate }),
    staleTime: 5 * 60 * 1000,
  });

  const totalTasks = data?.tasksByStatus.reduce((s, d) => s + d.count, 0) ?? 0;
  const termineeCount =
    data?.tasksByStatus.find((d) => ['terminee', 'livree'].includes(d.status))?.count ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="90 derniers jours"
          />
        </div>
        <ExportButton
          type="production"
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard label="Tâches terminées" value={termineeCount} />
          <KPICard
            label="En retard"
            value={data.tasksOverdue}
            valueClassName={data.tasksOverdue > 0 ? 'text-red-600' : undefined}
          />
          <KPICard label="Délai R→L moyen" value={`${data.delaiRLMoyen} j.o.`} />
          <KPICard
            label="Rendement moyen"
            value={`${data.rendementParOperateur.length > 0
              ? (data.rendementParOperateur.reduce((s, o) => s + o.rendement, 0) / data.rendementParOperateur.length).toFixed(1)
              : '—'}%`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tâches par statut — Horizontal Bar */}
        <ChartCard title="Tâches par statut">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              layout="vertical"
              data={(data?.tasksByStatus ?? []).map((d) => ({
                name: TASK_STATUS_LABELS[d.status] ?? d.status,
                Tâches: d.count,
              }))}
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="Tâches" fill="#FF6600" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Rendement par opérateur — Bar ranked */}
        <ChartCard title="Rendement par opérateur">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={(data?.rendementParOperateur ?? []).map((o) => ({
                name: o.operatorName,
                Rendement: o.rendement,
              }))}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Rendement']} />
              <Bar dataKey="Rendement" fill="#FF6600" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Production par semaine — Line: started vs completed */}
        <ChartCard title="Production par semaine (8 dernières semaines)" className="md:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={data?.productionByWeek ?? []}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="completed"
                name="Terminées"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="started"
                name="Démarrées"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top codes produits */}
      {data && data.topCodes.length > 0 && (
        <ChartCard title="Top codes produits">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code produit</TableHead>
                  <TableHead className="text-right">Nb tâches</TableHead>
                  <TableHead className="text-right">Rendement moyen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topCodes.map((row) => (
                  <TableRow key={row.codeProduit}>
                    <TableCell className="font-mono">{row.codeProduit}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className={`text-right ${rendementColor(row.rendementMoyen)}`}>
                      {row.rendementMoyen.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Chargement...
        </div>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/dashboards/production
git commit -m "feat(web): add Dashboard Production page with filters, charts, and top codes table"
```

---

## Task 13: Dashboard Financier page

**Files to create:**
- `apps/web/src/app/(app)/dashboards/financier/page.tsx`
- `apps/web/src/app/(app)/dashboards/financier/financier-client.tsx`

### Step 1: `apps/web/src/app/(app)/dashboards/financier/page.tsx`

```typescript
import { FinancierClient } from './financier-client';

export const metadata = { title: 'Dashboard Financier' };

export default function DashboardFinancierPage() {
  return <FinancierClient />;
}
```

### Step 2: `apps/web/src/app/(app)/dashboards/financier/financier-client.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { ExportButton } from '@/components/dashboard/ExportButton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const INVOICE_STATUS_COLORS: Record<string, string> = {
  brouillon: '#94a3b8',
  envoyee: '#3b82f6',
  en_attente: '#f97316',
  payee: '#22c55e',
  en_retard: '#ef4444',
  annulee: '#6b7280',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  en_attente: 'En attente',
  payee: 'Payée',
  en_retard: 'En retard',
  annulee: 'Annulée',
};

const MONTHS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

function formatEUR(value: number) {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function FinancierClient() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'financier', { year, month }],
    queryFn: () => dashboardApi.getFinancier({ year: Number(year), month: Number(month) }),
    staleTime: 5 * 60 * 1000,
  });

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Mois" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExportButton type="financier" />
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard label="CA HT" value={formatEUR(data.chiffreAffaireHT)} />
          <KPICard label="Achats HT" value={formatEUR(data.totalAchatsHT)} />
          <KPICard
            label="Marge brute"
            value={formatEUR(data.margeGrossiere)}
            valueClassName={data.margeGrossiere >= 0 ? 'text-green-700' : 'text-red-600'}
          />
          <KPICard
            label="Factures en attente"
            value={data.invoicesByStatus.find((s) => s.status === 'en_attente')?.count ?? 0}
            valueClassName="text-orange-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CA vs Achats par mois — Grouped Bar */}
        <ChartCard title="CA vs Achats par mois (12 mois)" className="md:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data?.revenueByMonth ?? []}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatEUR(value)} />
              <Legend />
              <Bar dataKey="CA" name="CA HT" fill="#FF6600" radius={[4, 4, 0, 0]} />
              <Bar dataKey="achats" name="Achats HT" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Factures par statut — Pie */}
        <ChartCard title="Factures par statut">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={(data?.invoicesByStatus ?? []).map((d) => ({
                  name: INVOICE_STATUS_LABELS[d.status] ?? d.status,
                  value: d.count,
                }))}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {(data?.invoicesByStatus ?? []).map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={INVOICE_STATUS_COLORS[entry.status] ?? '#cbd5e1'}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top 5 clients — Bar */}
        <ChartCard title="Top 5 clients (CA HT)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              layout="vertical"
              data={(data?.topClients ?? []).map((c) => ({
                name: c.clientName,
                'CA HT': c.totalHT,
              }))}
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(value: number) => formatEUR(value)} />
              <Bar dataKey="CA HT" fill="#FF6600" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Factures en retard de paiement */}
      {data && data.pendingInvoices.length > 0 && (
        <ChartCard title="Factures en retard de paiement">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Montant HT</TableHead>
                  <TableHead className="text-right">Échéance</TableHead>
                  <TableHead className="text-right">Retard</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pendingInvoices.map((inv) => {
                  const due = new Date(inv.dueDate);
                  const daysPast = Math.floor((Date.now() - due.getTime()) / 86400000);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.clientName}</TableCell>
                      <TableCell className="text-right">{formatEUR(inv.amount)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {due.toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{daysPast} j</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Chargement...
        </div>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/dashboards/financier
git commit -m "feat(web): add Dashboard Financier page with month/year selector, charts, and overdue invoices table"
```


---

## Task 14: Dashboard Client page

**Files to create:**
- `apps/web/src/app/(app)/dashboards/client/[clientId]/page.tsx`
- `apps/web/src/app/(app)/dashboards/client/[clientId]/client-dashboard-client.tsx`

### Step 1: `apps/web/src/app/(app)/dashboards/client/[clientId]/page.tsx`

```typescript
import { ClientDashboardClient } from './client-dashboard-client';

export const metadata = { title: 'Dashboard Client' };

interface Props {
  params: { clientId: string };
}

export default function ClientDashboardPage({ params }: Props) {
  return <ClientDashboardClient clientId={params.clientId} />;
}
```

### Step 2: `apps/web/src/app/(app)/dashboards/client/[clientId]/client-dashboard-client.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';

const TASK_STATUS_COLORS: Record<string, string> = {
  a_traiter: '#94a3b8',
  en_cours: '#3b82f6',
  en_revision: '#a855f7',
  terminee: '#22c55e',
  livree: '#10b981',
  annulee: '#ef4444',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  a_traiter: 'secondary',
  en_cours: 'default',
  en_revision: 'outline',
  terminee: 'default',
  livree: 'default',
  annulee: 'destructive',
};

interface Props {
  clientId: string;
}

export function ClientDashboardClient({ clientId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'client', clientId],
    queryFn: () => dashboardApi.getClient(clientId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Link
        href={`/clients/${clientId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Retour au client
      </Link>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Projets" value={data.projects.total} />
        <KPICard label="Tâches en cours" value={data.tasks.enCours} />
        <KPICard label="Tâches terminées" value={data.tasks.terminees} />
        <KPICard label="Sites" value={data.sites.total} />
      </div>

      {/* Last activity */}
      {data.lastActivity && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Dernière activité :{' '}
          {new Date(data.lastActivity).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tâches par statut — Donut */}
        <ChartCard title="Tâches par statut">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.tasksByStatus.map((d) => ({
                  name: TASK_STATUS_LABELS[d.status] ?? d.status,
                  value: d.count,
                }))}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
              >
                {data.tasksByStatus.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={TASK_STATUS_COLORS[entry.status] ?? '#cbd5e1'}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Recent tasks */}
        <ChartCard title="Tâches récentes">
          <div className="overflow-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Mise à jour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium text-sm">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="hover:text-[#FF6600] hover:underline"
                      >
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[task.status] ?? 'secondary'}>
                        {TASK_STATUS_LABELS[task.status] ?? task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(task.updatedAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/dashboards/client
git commit -m "feat(web): add Dashboard Client page with KPIs, donut chart, and recent tasks table"
```

---

## Task 15: Dashboard Employé page

**Files to create:**
- `apps/web/src/app/(app)/dashboards/employe/[employeeId]/page.tsx`
- `apps/web/src/app/(app)/dashboards/employe/[employeeId]/employe-dashboard-client.tsx`

### Step 1: `apps/web/src/app/(app)/dashboards/employe/[employeeId]/page.tsx`

```typescript
import { EmployeDashboardClient } from './employe-dashboard-client';

export const metadata = { title: "Dashboard Employé" };

interface Props {
  params: { employeeId: string };
}

export default function EmployeDashboardPage({ params }: Props) {
  return <EmployeDashboardClient employeeId={params.employeeId} />;
}
```

### Step 2: `apps/web/src/app/(app)/dashboards/employe/[employeeId]/employe-dashboard-client.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const TASK_STATUS_COLORS: Record<string, string> = {
  a_traiter: '#94a3b8',
  en_cours: '#3b82f6',
  en_revision: '#a855f7',
  terminee: '#22c55e',
  livree: '#10b981',
  annulee: '#ef4444',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  conge_paye: 'Congé payé',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  autre: 'Autre',
};

interface Props {
  employeeId: string;
}

export function EmployeDashboardClient({ employeeId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'employe', employeeId],
    queryFn: () => dashboardApi.getEmployee(employeeId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Link
        href={`/employees/${employeeId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Retour à l'employé
      </Link>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Tâches assignées" value={data.tasksAssigned} />
        <KPICard label="Tâches terminées" value={data.tasksCompleted} />
        <KPICard
          label="Rendement moyen"
          value={`${data.rendementMoyen.toFixed(1)}%`}
        />
        <KPICard label="Heures ce mois" value={`${data.hoursLogged.toFixed(1)} h`} />
      </div>

      {/* Congés restants */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Congés restants :</span>
        <Badge
          className="text-base px-3 py-1"
          style={{ backgroundColor: '#FF6600', color: 'white' }}
        >
          {data.congesRestants} j
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rendement par semaine — Line */}
        <ChartCard title="Rendement par semaine (8 semaines)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data.rendementByWeek}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Rendement']} />
              <Line
                type="monotone"
                dataKey="rendement"
                name="Rendement"
                stroke="#FF6600"
                strokeWidth={2}
                dot={{ r: 3, fill: '#FF6600' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Tâches par statut — Donut */}
        <ChartCard title="Tâches par statut">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data.tasksByStatus.map((d) => ({
                  name: TASK_STATUS_LABELS[d.status] ?? d.status,
                  value: d.count,
                }))}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.tasksByStatus.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={TASK_STATUS_COLORS[entry.status] ?? '#cbd5e1'}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Upcoming leaves */}
      {data.upcomingLeaves.length > 0 && (
        <ChartCard title="Congés à venir">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Du</TableHead>
                <TableHead>Au</TableHead>
                <TableHead className="text-right">Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.upcomingLeaves.map((leave, idx) => {
                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);
                const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
                return (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline">
                        {LEAVE_TYPE_LABELS[leave.type] ?? leave.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {start.toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {end.toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right text-sm">{days} j</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ChartCard>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/dashboards/employe
git commit -m "feat(web): add Dashboard Employé page with KPIs, rendement line chart, and upcoming leaves"
```


---

## Task 16: Dashboard Rentabilité Salariale page

**Files to create:**
- `apps/web/src/app/(app)/dashboards/rentabilite/page.tsx`
- `apps/web/src/app/(app)/dashboards/rentabilite/rentabilite-client.tsx`

### Step 1: `apps/web/src/app/(app)/dashboards/rentabilite/page.tsx`

```typescript
import { RentabiliteClient } from './rentabilite-client';

export const metadata = { title: 'Rentabilité Salariale' };

export default function DashboardRentabilitePage() {
  return <RentabiliteClient />;
}
```

### Step 2: `apps/web/src/app/(app)/dashboards/rentabilite/rentabilite-client.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import type { RentabiliteEmployee } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { ExportButton } from '@/components/dashboard/ExportButton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const MONTHS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

function formatEUR(value: number) {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

/**
 * Ratio color coding:
 * - green:  ratio >= 1.2
 * - yellow: 0.8 <= ratio < 1.2
 * - red:    ratio < 0.8
 */
function ratioClass(ratio: number): string {
  if (ratio >= 1.2) return 'text-green-700 font-semibold';
  if (ratio >= 0.8) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
}

function ratioBg(ratio: number): string {
  if (ratio >= 1.2) return 'bg-green-50';
  if (ratio >= 0.8) return 'bg-yellow-50';
  return 'bg-red-50';
}

export function RentabiliteClient() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'rentabilite', { year, month }],
    queryFn: () => dashboardApi.getRentabilite({ year: Number(year), month: Number(month) }),
    staleTime: 5 * 60 * 1000,
  });

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Mois" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExportButton type="rentabilite" />
      </div>

      {/* Summary KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KPICard label="Masse salariale chargée" value={formatEUR(data.totals.masseSalariale)} />
          <KPICard label="Revenu généré" value={formatEUR(data.totals.revenueTotal)} />
          <KPICard
            label="Ratio global"
            value={data.totals.ratioGlobal.toFixed(2)}
            valueClassName={ratioClass(data.totals.ratioGlobal)}
          />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
          Ratio ≥ 1.2 (rentable)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" />
          0.8 – 1.19 (acceptable)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          &lt; 0.8 (déficitaire)
        </span>
      </div>

      {/* DataTable */}
      <ChartCard title="Détail par employé">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead className="text-right">Salaire chargé</TableHead>
                <TableHead className="text-right">Revenu généré</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
                <TableHead className="text-right">Heures</TableHead>
                <TableHead className="text-right">Taux occupation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              )}
              {data?.employees.map((emp: RentabiliteEmployee) => (
                <TableRow key={emp.employeeId} className={cn('', ratioBg(emp.ratio))}>
                  <TableCell className="font-medium">{emp.employeeName}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatEUR(emp.salaireCharge)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatEUR(emp.revenueGenere)}
                  </TableCell>
                  <TableCell className={cn('text-right', ratioClass(emp.ratio))}>
                    {emp.ratio.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {emp.hoursLogged.toFixed(1)} h
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {emp.tauxOccupation.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              {data && (
                <TableRow className="border-t-2 font-semibold bg-muted/30">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">
                    {formatEUR(data.totals.masseSalariale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEUR(data.totals.revenueTotal)}
                  </TableCell>
                  <TableCell className={cn('text-right', ratioClass(data.totals.ratioGlobal))}>
                    {data.totals.ratioGlobal.toFixed(2)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/dashboards/rentabilite
git commit -m "feat(web): add Dashboard Rentabilité Salariale page with color-coded ratio DataTable"
```

---

## Task 17: Update Sidebar with Tableaux de bord section

**File to edit:** `apps/web/src/components/layout/sidebar.tsx`

Replace the current `navItems` array and the `Sidebar` component with the version below, which adds a "Tableaux de bord" section with sub-links, grouped navigation, and a collapsible sub-menu:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FolderKanban, CheckSquare, MapPin, Users, Building2,
  Package, FileText, Receipt, Euro, MessageSquare,
  Upload, Settings, BarChart3, CalendarDays, ChevronLeft, ChevronRight,
  FileCheck, TrendingUp, Factory, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

type NavEntry = NavItem | { group: NavGroup };

const navEntries: NavEntry[] = [
  { label: 'Projets', href: '/projects', icon: FolderKanban },
  { label: 'Tâches', href: '/tasks', icon: CheckSquare },
  { label: 'Sites', href: '/sites', icon: MapPin },
  { label: 'Clients', href: '/clients', icon: Building2 },
  { label: 'Codes produits', href: '/products', icon: Package },
  { label: 'Bordereaux', href: '/commercial/attachments', icon: FileText },
  { label: 'Devis', href: '/commercial/quotes', icon: FileCheck },
  { label: 'Factures', href: '/commercial/invoices', icon: Euro },
  { label: 'Comptabilité', href: '/accounting', icon: Euro },
  { label: 'Employés', href: '/employees', icon: Users },
  { label: 'Congés', href: '/leaves', icon: CalendarDays },
  { label: 'Demandes', href: '/demands', icon: Receipt },
  { label: 'Messagerie', href: '/messages', icon: MessageSquare },
  { label: 'Import', href: '/import', icon: Upload },
  {
    group: {
      label: 'Tableaux de bord',
      icon: BarChart3,
      items: [
        { label: 'Général', href: '/dashboards', icon: LayoutDashboard, exact: true },
        { label: 'Production', href: '/dashboards/production', icon: Factory },
        { label: 'Financier', href: '/dashboards/financier', icon: Euro },
        { label: 'Rentabilité', href: '/dashboards/rentabilite', icon: TrendingUp },
      ],
    },
  },
  { label: 'Administration', href: '/admin', icon: Settings },
];

function isNavItem(entry: NavEntry): entry is NavItem {
  return 'href' in entry;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [dashboardsOpen, setDashboardsOpen] = useState(
    pathname.startsWith('/dashboards'),
  );

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-card border-r border-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          ET
        </div>
        {!collapsed && (
          <span className="font-bold text-lg text-foreground">ExeTeam</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {navEntries.map((entry) => {
          if (isNavItem(entry)) {
            const Icon = entry.icon;
            const isActive = entry.exact
              ? pathname === entry.href
              : pathname.startsWith(entry.href);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{entry.label}</span>}
              </Link>
            );
          }

          // Group
          const group = entry.group;
          const GroupIcon = group.icon;
          const groupActive = group.items.some((item) =>
            item.exact ? pathname === item.href : pathname.startsWith(item.href),
          );

          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => !collapsed && setDashboardsOpen((o) => !o)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  groupActive
                    ? 'text-[#FF6600] bg-orange-50'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <GroupIcon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    {dashboardsOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </>
                )}
              </button>

              {!collapsed && dashboardsOpen && (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-border pl-3">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                          isActive
                            ? 'text-[#FF6600] font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse button */}
      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/layout/sidebar.tsx
git commit -m "feat(web): update Sidebar with collapsible Tableaux de bord section"
```

---

## Task 18: Final commit

After all tasks are implemented and verified locally:

```bash
git add -A
git commit -m "feat: Sprint 4C complete — Dashboards module with General, Production, Financier, Client, Employee, and Rentabilite pages"
```

Then open a PR:

```bash
gh pr create \
  --title "feat: Sprint 4C — Tableaux de bord" \
  --body "## Sprint 4C implementation

### Backend (NestJS)
- **DashboardModule**: \`DashboardService\` + \`DashboardController\` registered in \`AppModule\`
- **GET /dashboard/general**: 6 KPIs (clients, projects, tasks, employees, revenue, rendement), tasksByStatus, projectsByStatus, tasksCompletedByWeek (last 8 weeks)
- **GET /dashboard/production**: tasksByStatus, rendementParOperateur, delaiRLMoyen (business days), tasksOverdue, productionByWeek (last 8 weeks), topCodes; optional filters: startDate, endDate, operatorId, clientId
- **GET /dashboard/financier**: CA HT/TTC, achats, margeGrossiere, invoicesByStatus, revenueByMonth (12 months), topClients (5), pendingInvoices — restricted to gerant/comptable/super_admin
- **GET /dashboard/client/:clientId**: projects, tasks, sites, lastActivity, tasksByStatus, recentTasks (10) — no internal cost data
- **GET /dashboard/employe/:employeeId**: tasksAssigned, tasksCompleted, rendementMoyen, hoursLogged, congesRestants, rendementByWeek (8 weeks), upcomingLeaves
- **GET /dashboard/rentabilite-salariale**: salaireCharge (gross × (1 + chargesRate)), revenueGenere (from InvoiceLine → facturable tasks), ratio, hoursLogged, tauxOccupation — restricted to gerant/comptable/super_admin
- **GET /dashboard/export**: Excel export via ExcelJS, streamed with Content-Disposition header; all 4 types (general, production, financier, rentabilite) — financier/rentabilite gated by role

### Frontend (Next.js)
- **/dashboards**: Dashboard Général — 6 KPICard, PieChart (tasks), BarChart (projects), Donut (employees), LineChart (activity)
- **/dashboards/production**: filters (DateRangePicker), 4 KPIs, horizontal BarChart (tasks), BarChart (rendement/operator), LineChart (started vs completed), Top codes table; ExportButton
- **/dashboards/financier**: month/year selector, 4 KPIs, Grouped BarChart (CA vs achats 12 months), PieChart (invoices), horizontal BarChart (top 5 clients), overdue invoices table; ExportButton
- **/dashboards/client/[clientId]**: 4 KPIs, Donut (tasks), recent tasks table with links
- **/dashboards/employe/[employeeId]**: 4 KPIs, congés restants badge, LineChart (rendement/week), Donut (tasks), upcoming leaves table
- **/dashboards/rentabilite**: month/year selector, 3 summary KPIs, color-coded DataTable (green ≥ 1.2 / yellow 0.8–1.19 / red < 0.8), totals row; ExportButton

### Shared
- **\`packages/shared/src/dashboard.ts\`**: 6 TypeScript interfaces exported via index
- **Sidebar update**: collapsible 'Tableaux de bord' group with 4 sub-links (Général, Production, Financier, Rentabilité)

### Business rules
- All monetary values: \`toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })\`
- Rendement: \`(codeProduit.timeGamme / sum(timeEntries.hours)) × 100\`
- Délai R→L: business days excluding weekends + public_holidays (country=FR)
- Ratio rentabilité: revenueGenere / salaireCharge; salaireCharge = grossSalary × (1 + chargesRate)
- Dashboard financier + rentabilité: role check in controller (gerant | comptable | super_admin)
- TanStack Query \`staleTime: 5 * 60 * 1000\` on all dashboard queries

**Branch:** feat/dashboards
**Prerequisite sprints:** 2A (clients), 2B (sites), 2C (custom fields), 2D (employees/leaves), 3A (projects/tasks/time-entries), 3C (commercial/invoices), 4A (accounting)" \
  --base main \
  --head feat/dashboards
```

---

## Implementation Notes

### Recharts patterns
- All charts use `<ResponsiveContainer width="100%" height={240}>` so they resize fluidly in the grid.
- Tooltips are always included. `Legend` is added for charts with multiple series.
- EUR formatting in tooltips uses `formatter={(value: number) => formatEUR(value)}`.
- Donut charts use `innerRadius`/`outerRadius` on `<Pie>` and a `<Cell>` per data entry for color mapping.

### ExcelJS export streaming
- The controller method takes `@Res() res: Response` directly and calls `workbook.xlsx.write(res)` then `res.end()`.
- Do **not** add `passthrough: true` to `@Res()`; we own the response entirely.
- The `Content-Disposition` header uses `attachment; filename="..."` so the browser prompts a file download.
- Multi-sheet workbooks: each logical section gets its own worksheet via `workbook.addWorksheet(name)`.

### Role guard pattern
- The controller checks `req.user.role` directly with a `Set` of allowed roles rather than using `@RequirePermissions`, because `dashboard:financier` and `dashboard:rentabilite` are role-based rather than permission-key-based.
- If the RBAC permission system is later extended with fine-grained keys, replace with `@RequirePermissions('dashboard:financier')`.

### Rendement calculation
- Formula: `(codeProduit.timeGamme / actualTotalHours) × 100`
- `timeGamme` is the standard time per unit (stored in minutes or hours — confirm unit from Prisma schema).
- If a task has no time entries, it is excluded from the average (division by zero guard).
- Color coding: green ≥ 90%, yellow 70–89%, red < 70% (tasks); green ≥ 1.2, yellow 0.8–1.19, red < 0.8 (rentabilité ratio).

### Délai R→L in DashboardService
- Reuses the `countBusinessDays` helper also used in Sprint 3A `TasksService`.
- Public holidays fetched from `prisma.publicHoliday` where `country = 'FR'` and within the query date range.
- For the production dashboard, the mean is taken over all finished tasks in the date window that have both `dateReception` and `actualEndDate` set.

### TanStack Query cache
- `staleTime: 5 * 60 * 1000` (5 minutes) on all dashboard queries avoids hammering the API on tab switches.
- Each dashboard page has a distinct query key scoped by type + filter params, so switching filters properly re-fetches.

### Client / employee dashboards from other pages
- The `ClientDashboardClient` and `EmployeDashboardClient` components can be embedded in the client detail page (`/clients/[id]`) and employee detail page (`/employees/[id]`) respectively as an additional tab, by importing the component directly and passing the entity ID as a prop.

### Sidebar collapsible group
- `dashboardsOpen` state defaults to `pathname.startsWith('/dashboards')` so the group auto-expands when navigating to a dashboard page.
- When the sidebar is collapsed (icon-only mode), the group button shows only the `BarChart3` icon; the sub-menu is hidden.

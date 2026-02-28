# ExeTeam Sprint 3A — Projets & Tâches Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Projects and Tasks modules — NestJS API + Next.js UI — with Kanban view, Gantt chart, time entries, deliverable management, and business logic (Délai R→L, Rendement, status change validation).

**Architecture:** NestJS ProjectsModule + TasksModule + TimeEntriesModule expose REST endpoints. Next.js pages use TanStack Query. The tasks list has both a Kanban view and table view. The Gantt view uses frappe-gantt. Business logic (Délai R→L, rendement) is computed server-side.

**Tech Stack:** NestJS · Prisma · Zod pipes · TanStack Query · shadcn/ui · react-hook-form + zod · frappe-gantt

**Prerequisite:** Sprint 2A (clients), Sprint 2C (codes produits, DynamicForm), Sprint 2D (employees, public holidays) complete.

---

## Task 1: Create branch `feat/projects-tasks`

```bash
git checkout main && git pull origin main
git checkout -b feat/projects-tasks
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/projects-tasks branch"
```

---

## Task 2: Install frappe-gantt dependency

```bash
cd apps/web && pnpm add frappe-gantt
cd apps/web && pnpm add -D @types/frappe-gantt
```

**Commit:**
```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "chore(web): add frappe-gantt dependency"
```

---

## Task 3: NestJS ProjectsModule

**Files to create:**
- `apps/api/src/projects/dto/create-project.dto.ts`
- `apps/api/src/projects/dto/update-project.dto.ts`
- `apps/api/src/projects/dto/list-projects.dto.ts`
- `apps/api/src/projects/projects.service.ts`
- `apps/api/src/projects/projects.controller.ts`
- `apps/api/src/projects/projects.module.ts`

### Step 1: `apps/api/src/projects/dto/create-project.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),
  responsibleId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  status: z.string().default('brouillon'),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  actualStartDate: z.coerce.date().optional(),
  actualEndDate: z.coerce.date().optional(),
  budgetHours: z.coerce.number().nonnegative().optional(),
  customFieldsConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  tagIds: z.array(z.string().uuid()).default([]),
});

export class CreateProjectDto extends createZodDto(CreateProjectSchema) {}
```

### Step 2: `apps/api/src/projects/dto/update-project.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { CreateProjectSchema } from './create-project.dto';

export const UpdateProjectSchema = CreateProjectSchema.partial();
export class UpdateProjectDto extends createZodDto(UpdateProjectSchema) {}
```

### Step 3: `apps/api/src/projects/dto/list-projects.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  operatorId: z.string().uuid().optional(),
  responsibleId: z.string().uuid().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export class ListProjectsDto extends createZodDto(ListProjectsSchema) {}
```

### Step 4: `apps/api/src/projects/projects.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListProjectsDto) {
    const { page, limit, search, clientId, operatorId, responsibleId, status, priority, isActive } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (clientId) where['clientId'] = clientId;
    if (operatorId) where['operatorId'] = operatorId;
    if (responsibleId) where['responsibleId'] = responsibleId;
    if (status) where['status'] = status;
    if (priority) where['priority'] = priority;
    if (isActive !== undefined) where['isActive'] = isActive;

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, logoUrl: true } },
          operator: { select: { id: true, name: true } },
          responsible: { select: { id: true, firstName: true, lastName: true } },
          tags: { include: { tag: true } },
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    // Compute advancement: percentage of tasks in terminal status
    const dataWithStats = await Promise.all(
      data.map(async (project) => {
        const [totalTasks, doneTasks] = await Promise.all([
          this.prisma.task.count({ where: { projectId: project.id, deletedAt: null } }),
          this.prisma.task.count({
            where: {
              projectId: project.id,
              deletedAt: null,
              status: { in: ['terminee', 'livree'] },
            },
          }),
        ]);
        const advancement = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
        return { ...project, advancement };
      }),
    );

    return { data: dataWithStats, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        operator: { select: { id: true, name: true } },
        responsible: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        tags: { include: { tag: true } },
        tasks: {
          where: { deletedAt: null },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
            codeProduit: { select: { id: true, code: true, designation: true } },
            _count: { select: { timeEntries: true, comments: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { tasks: true, demands: true, attachments: true } },
      },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async create(dto: CreateProjectDto) {
    const { tagIds, ...data } = dto;

    // Generate reference: PROJ-YYYYMM-XXXX
    const count = await this.prisma.project.count();
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const reference = `PROJ-${yyyymm}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.project.create({
      data: {
        ...data,
        reference,
        ...(tagIds?.length
          ? { tags: { create: tagIds.map((tagId) => ({ tagId, entityType: 'project' })) } }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        responsible: { select: { id: true, firstName: true, lastName: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    const { tagIds, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        await tx.entityTag.deleteMany({ where: { entityId: id, entityType: 'project' } });
        if (tagIds.length > 0) {
          await tx.entityTag.createMany({
            data: tagIds.map((tagId) => ({ tagId, entityId: id, entityType: 'project' })),
          });
        }
      }
      return tx.project.update({
        where: { id },
        data,
        include: {
          client: { select: { id: true, name: true } },
          operator: { select: { id: true, name: true } },
          responsible: { select: { id: true, firstName: true, lastName: true } },
          tags: { include: { tag: true } },
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getStats() {
    const now = new Date();

    const [active, inProgress, overdue] = await Promise.all([
      this.prisma.project.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.project.count({
        where: { deletedAt: null, status: { in: ['en_cours', 'en_revision'] } },
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          isActive: true,
          plannedEndDate: { lt: now },
          status: { notIn: ['terminee', 'livree', 'annulee'] },
        },
      }),
    ]);

    // Average advancement across active projects
    const activeTasks = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: { deletedAt: null, project: { deletedAt: null, isActive: true } },
      _count: { id: true },
    });
    const doneTasks = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: {
        deletedAt: null,
        project: { deletedAt: null, isActive: true },
        status: { in: ['terminee', 'livree'] },
      },
      _count: { id: true },
    });

    let avgAdvancement = 0;
    if (activeTasks.length > 0) {
      const doneMap = new Map(doneTasks.map((d) => [d.projectId, d._count.id]));
      const total = activeTasks.reduce((sum, at) => {
        const done = doneMap.get(at.projectId) ?? 0;
        return sum + (at._count.id > 0 ? (done / at._count.id) * 100 : 0);
      }, 0);
      avgAdvancement = Math.round(total / activeTasks.length);
    }

    return { active, inProgress, avgAdvancement, overdue };
  }
}
```

### Step 5: `apps/api/src/projects/projects.controller.ts`

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('stats')
  @RequirePermissions('projects.read')
  getStats() {
    return this.projectsService.getStats();
  }

  @Get()
  @RequirePermissions('projects.read')
  findAll(@Query() dto: ListProjectsDto) {
    return this.projectsService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('projects.read')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @RequirePermissions('projects.create')
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('projects.update')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('projects.delete')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
```

### Step 6: `apps/api/src/projects/projects.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

**Commit:**
```bash
git add apps/api/src/projects
git commit -m "feat(api): add ProjectsModule with CRUD, stats, and advancement computation"
```

---

## Task 4: NestJS TasksModule

**Files to create:**
- `apps/api/src/tasks/dto/create-task.dto.ts`
- `apps/api/src/tasks/dto/update-task.dto.ts`
- `apps/api/src/tasks/dto/list-tasks.dto.ts`
- `apps/api/src/tasks/dto/add-deliverable.dto.ts`
- `apps/api/src/tasks/dto/add-comment.dto.ts`
- `apps/api/src/tasks/tasks.service.ts`
- `apps/api/src/tasks/tasks.controller.ts`
- `apps/api/src/tasks/tasks.module.ts`

### Step 1: `apps/api/src/tasks/dto/create-task.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  codeProduitId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  demandId: z.string().uuid().optional(),
  status: z.string().default('a_traiter'),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  dateReception: z.coerce.date().optional(),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  actualStartDate: z.coerce.date().optional(),
  actualEndDate: z.coerce.date().optional(),
  estimatedHours: z.coerce.number().nonnegative().optional(),
  budgetHours: z.coerce.number().nonnegative().optional(),
  facturable: z.boolean().default(true),
  customFieldsData: z.record(z.unknown()).optional(),
  tagIds: z.array(z.string().uuid()).default([]),
});

export class CreateTaskDto extends createZodDto(CreateTaskSchema) {}
```

### Step 2: `apps/api/src/tasks/dto/update-task.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { CreateTaskSchema } from './create-task.dto';

export const UpdateTaskSchema = CreateTaskSchema.partial();
export class UpdateTaskDto extends createZodDto(UpdateTaskSchema) {}
```

### Step 3: `apps/api/src/tasks/dto/list-tasks.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListTasksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  projectId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  codeProduitId: z.string().uuid().optional(),
  status: z.string().optional(),
  facturable: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export class ListTasksDto extends createZodDto(ListTasksSchema) {}
```

### Step 4: `apps/api/src/tasks/dto/add-deliverable.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddDeliverableSchema = z.object({
  url: z.string().url(),
  type: z.enum(['sharepoint', 'onedrive', 'dropbox', 'gdrive', 'url']).optional(),
  label: z.string().optional(),
});

export class AddDeliverableDto extends createZodDto(AddDeliverableSchema) {}
```

### Step 5: `apps/api/src/tasks/dto/add-comment.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddCommentSchema = z.object({
  content: z.string().min(1),
  attachments: z.array(z.string()).default([]),
});

export class AddCommentDto extends createZodDto(AddCommentSchema) {}
```

### Step 6: `apps/api/src/tasks/tasks.service.ts`

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { AddDeliverableDto } from './dto/add-deliverable.dto';
import { AddCommentDto } from './dto/add-comment.dto';

const TERMINAL_STATUSES = ['terminee', 'livree'];

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Business Logic Helpers ────────────────────────────────────────────────

  /**
   * Calculate working days between two dates, excluding weekends
   * and French public holidays stored in the public_holidays table.
   */
  private async calcDelaiRL(
    dateReception: Date | null,
    endDate: Date | null,
  ): Promise<number | null> {
    if (!dateReception) return null;
    const end = endDate ?? new Date();

    const start = new Date(dateReception);
    start.setHours(0, 0, 0, 0);
    const finish = new Date(end);
    finish.setHours(0, 0, 0, 0);

    if (finish <= start) return 0;

    // Fetch all public holidays in the range
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        country: 'FR',
        date: { gte: start, lte: finish },
      },
      select: { date: true },
    });
    const holidaySet = new Set(
      holidays.map((h) => h.date.toISOString().split('T')[0]),
    );

    let count = 0;
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + 1); // start counting from day after reception

    while (cursor <= finish) {
      const day = cursor.getDay(); // 0=Sun, 6=Sat
      const iso = cursor.toISOString().split('T')[0];
      if (day !== 0 && day !== 6 && !holidaySet.has(iso)) {
        count++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }

  /**
   * Calculate Rendement = (timeGamme × quantity) / sum(hours) × 100
   * quantity defaults to 1 unless linked demand has a quantity.
   */
  private calcRendement(
    timeGamme: number | null,
    totalHours: number,
    quantity = 1,
  ): number | null {
    if (!timeGamme || totalHours === 0) return null;
    return Math.round(((timeGamme * quantity) / totalHours) * 100 * 10) / 10;
  }

  private async enrichTask(task: Record<string, unknown> & {
    dateReception?: Date | null;
    actualEndDate?: Date | null;
    codeProduit?: { timeGamme?: unknown } | null;
    timeEntries?: Array<{ hours: unknown }>;
    demand?: { quantity?: number } | null;
  }) {
    const delaiRL = await this.calcDelaiRL(
      task.dateReception ?? null,
      task.actualEndDate ?? null,
    );

    const totalHours = (task.timeEntries ?? []).reduce(
      (sum: number, e) => sum + Number(e.hours),
      0,
    );
    const timeGamme = task.codeProduit?.timeGamme
      ? Number(task.codeProduit.timeGamme)
      : null;
    const quantity = task.demand?.quantity ?? 1;
    const rendement = this.calcRendement(timeGamme, totalHours, quantity);

    return { ...task, delaiRL, rendement, totalHours };
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(dto: ListTasksDto) {
    const { page, limit, search, projectId, siteId, employeeId, codeProduitId, status, facturable, dateFrom, dateTo } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (projectId) where['projectId'] = projectId;
    if (siteId) where['siteId'] = siteId;
    if (employeeId) where['employeeId'] = employeeId;
    if (codeProduitId) where['codeProduitId'] = codeProduitId;
    if (status) where['status'] = status;
    if (facturable !== undefined) where['facturable'] = facturable;
    if (dateFrom || dateTo) {
      where['dateReception'] = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, reference: true, title: true } },
          site: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          codeProduit: { select: { id: true, code: true, designation: true, timeGamme: true } },
          timeEntries: { select: { hours: true } },
          demand: { select: { quantity: true } },
          _count: { select: { comments: true, deliverables: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    const enriched = await Promise.all(data.map((t) => this.enrichTask(t as never)));

    return { data: enriched, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id, deletedAt: null },
      include: {
        project: { select: { id: true, reference: true, title: true, customFieldsConfig: true } },
        site: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        codeProduit: { select: { id: true, code: true, designation: true, timeGamme: true } },
        demand: { select: { id: true, quantity: true } },
        timeEntries: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
            user: { select: { id: true, email: true } },
          },
          orderBy: { date: 'desc' },
        },
        comments: {
          include: { author: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: { user: { select: { id: true, email: true } } },
          orderBy: { changedAt: 'asc' },
        },
        deliverables: { orderBy: { createdAt: 'desc' } },
        tags: { include: { tag: true } },
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.enrichTask(task as never);
  }

  async create(dto: CreateTaskDto) {
    const { tagIds, ...data } = dto;

    const count = await this.prisma.task.count();
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const reference = `TACHE-${yyyymm}-${String(count + 1).padStart(4, '0')}`;

    const task = await this.prisma.task.create({
      data: {
        ...data,
        reference,
        dateLastStatus: new Date(),
        ...(tagIds?.length
          ? { tags: { create: tagIds.map((tagId) => ({ tagId, entityType: 'task' })) } }
          : {}),
      },
      include: {
        project: { select: { id: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        codeProduit: { select: { id: true, code: true, designation: true, timeGamme: true } },
        timeEntries: { select: { hours: true } },
        demand: { select: { quantity: true } },
      },
    });

    return this.enrichTask(task as never);
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const existing = await this.findOne(id);
    const { tagIds, ...data } = dto;

    // Status change validation
    if (dto.status && dto.status !== (existing as Record<string, unknown>)['status']) {
      if (TERMINAL_STATUSES.includes(dto.status)) {
        const deliverableCount = await this.prisma.taskDeliverable.count({ where: { taskId: id } });
        const hasDeliverableLinks = Array.isArray((existing as Record<string, unknown>)['deliverableLinks'])
          && ((existing as Record<string, unknown>)['deliverableLinks'] as string[]).length > 0;
        if (deliverableCount === 0 && !hasDeliverableLinks) {
          throw new BadRequestException(
            `Cannot move task to "${dto.status}" without at least one deliverable link.`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        await tx.entityTag.deleteMany({ where: { entityId: id, entityType: 'task' } });
        if (tagIds.length > 0) {
          await tx.entityTag.createMany({
            data: tagIds.map((tagId) => ({ tagId, entityId: id, entityType: 'task' })),
          });
        }
      }

      // Auto-create status history on status change
      const currentStatus = (existing as Record<string, unknown>)['status'] as string;
      if (dto.status && dto.status !== currentStatus) {
        await tx.statusHistory.create({
          data: {
            taskId: id,
            userId,
            previousStatus: currentStatus,
            newStatus: dto.status,
          },
        });
        data['dateLastStatus'] = new Date();
      }

      const updated = await tx.task.update({
        where: { id },
        data,
        include: {
          project: { select: { id: true, reference: true, title: true, customFieldsConfig: true } },
          site: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          codeProduit: { select: { id: true, code: true, designation: true, timeGamme: true } },
          demand: { select: { id: true, quantity: true } },
          timeEntries: { select: { hours: true } },
          comments: {
            include: { author: { select: { id: true, email: true } } },
            orderBy: { createdAt: 'asc' },
          },
          statusHistory: {
            include: { user: { select: { id: true, email: true } } },
            orderBy: { changedAt: 'asc' },
          },
          deliverables: { orderBy: { createdAt: 'desc' } },
          tags: { include: { tag: true } },
        },
      });

      return this.enrichTask(updated as never);
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addDeliverable(taskId: string, dto: AddDeliverableDto) {
    await this.findOne(taskId);
    return this.prisma.taskDeliverable.create({ data: { taskId, ...dto } });
  }

  async removeDeliverable(taskId: string, deliverableId: string) {
    await this.findOne(taskId);
    const d = await this.prisma.taskDeliverable.findFirst({
      where: { id: deliverableId, taskId },
    });
    if (!d) throw new NotFoundException('Deliverable not found');
    return this.prisma.taskDeliverable.delete({ where: { id: deliverableId } });
  }

  async addComment(taskId: string, dto: AddCommentDto, authorId: string) {
    await this.findOne(taskId);
    return this.prisma.taskComment.create({
      data: { taskId, authorId, content: dto.content, attachments: dto.attachments },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  async deleteComment(taskId: string, commentId: string, userId: string) {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new BadRequestException('You can only delete your own comments');
    }
    return this.prisma.taskComment.delete({ where: { id: commentId } });
  }

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, inProgress, doneThisMonth] = await Promise.all([
      this.prisma.task.count({ where: { deletedAt: null } }),
      this.prisma.task.count({
        where: { deletedAt: null, status: { in: ['en_cours', 'en_revision'] } },
      }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          status: { in: ['terminee', 'livree'] },
          actualEndDate: { gte: startOfMonth },
        },
      }),
    ]);

    // Global rendement: average over tasks with time entries and a timeGamme
    const tasksWithHours = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        timeEntries: { some: {} },
        codeProduit: { timeGamme: { not: null } },
      },
      include: {
        timeEntries: { select: { hours: true } },
        codeProduit: { select: { timeGamme: true } },
        demand: { select: { quantity: true } },
      },
      take: 200,
    });

    let avgRendement = 0;
    if (tasksWithHours.length > 0) {
      const rendered = tasksWithHours
        .map((t) => {
          const totalHours = t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
          const tg = t.codeProduit?.timeGamme ? Number(t.codeProduit.timeGamme) : null;
          const qty = t.demand?.quantity ?? 1;
          return tg && totalHours > 0 ? (tg * qty) / totalHours * 100 : null;
        })
        .filter((v): v is number => v !== null);

      if (rendered.length > 0) {
        avgRendement = Math.round(rendered.reduce((s, v) => s + v, 0) / rendered.length);
      }
    }

    return { total, inProgress, doneThisMonth, avgRendement };
  }
}
```

### Step 7: `apps/api/src/tasks/tasks.controller.ts`

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { AddDeliverableDto } from './dto/add-deliverable.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import type { AuthUser } from '../auth/supabase.strategy';

interface RequestWithUser {
  user: AuthUser;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('stats')
  @RequirePermissions('tasks.read')
  getStats() {
    return this.tasksService.getStats();
  }

  @Get()
  @RequirePermissions('tasks.read')
  findAll(@Query() dto: ListTasksDto) {
    return this.tasksService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('tasks.read')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @RequirePermissions('tasks.create')
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tasks.update')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req: RequestWithUser) {
    return this.tasksService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions('tasks.delete')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  @Post(':id/deliverables')
  @RequirePermissions('tasks.update')
  addDeliverable(@Param('id') id: string, @Body() dto: AddDeliverableDto) {
    return this.tasksService.addDeliverable(id, dto);
  }

  @Delete(':id/deliverables/:deliverableId')
  @RequirePermissions('tasks.update')
  removeDeliverable(
    @Param('id') id: string,
    @Param('deliverableId') deliverableId: string,
  ) {
    return this.tasksService.removeDeliverable(id, deliverableId);
  }

  @Post(':id/comments')
  @RequirePermissions('tasks.update')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tasksService.addComment(id, dto, req.user.id);
  }

  @Delete(':id/comments/:commentId')
  @RequirePermissions('tasks.update')
  deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.tasksService.deleteComment(id, commentId, req.user.id);
  }
}
```

### Step 8: `apps/api/src/tasks/tasks.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
```

**Commit:**
```bash
git add apps/api/src/tasks
git commit -m "feat(api): add TasksModule with Délai R→L, Rendement, status validation, and history"
```

---

## Task 5: NestJS TimeEntriesModule

**Files to create:**
- `apps/api/src/time-entries/dto/create-time-entry.dto.ts`
- `apps/api/src/time-entries/dto/update-time-entry.dto.ts`
- `apps/api/src/time-entries/dto/list-time-entries.dto.ts`
- `apps/api/src/time-entries/time-entries.service.ts`
- `apps/api/src/time-entries/time-entries.controller.ts`
- `apps/api/src/time-entries/time-entries.module.ts`

### Step 1: `apps/api/src/time-entries/dto/create-time-entry.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTimeEntrySchema = z.object({
  taskId: z.string().uuid(),
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  hours: z.coerce.number().positive().max(24),
  comment: z.string().optional(),
});

export class CreateTimeEntryDto extends createZodDto(CreateTimeEntrySchema) {}
```

### Step 2: `apps/api/src/time-entries/dto/update-time-entry.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { CreateTimeEntrySchema } from './create-time-entry.dto';

export const UpdateTimeEntrySchema = CreateTimeEntrySchema.omit({ taskId: true }).partial();
export class UpdateTimeEntryDto extends createZodDto(UpdateTimeEntrySchema) {}
```

### Step 3: `apps/api/src/time-entries/dto/list-time-entries.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListTimeEntriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  taskId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  isValidated: z.coerce.boolean().optional(),
});

export class ListTimeEntriesDto extends createZodDto(ListTimeEntriesSchema) {}
```

### Step 4: `apps/api/src/time-entries/time-entries.service.ts`

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

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
    // Validate total hours on this day does not exceed 24
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
    await this.findOne(id);

    if (dto.hours !== undefined || dto.date !== undefined || dto.employeeId !== undefined) {
      const current = await this.findOne(id);
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
    await this.findOne(id);
    return this.prisma.timeEntry.delete({ where: { id } });
  }

  async validate(id: string) {
    await this.findOne(id);
    return this.prisma.timeEntry.update({ where: { id }, data: { isValidated: true } });
  }
}
```

### Step 5: `apps/api/src/time-entries/time-entries.controller.ts`

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';
import type { AuthUser } from '../auth/supabase.strategy';

interface RequestWithUser {
  user: AuthUser;
}

@Controller('time-entries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  @RequirePermissions('tasks.read')
  findAll(@Query() dto: ListTimeEntriesDto) {
    return this.timeEntriesService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('tasks.read')
  findOne(@Param('id') id: string) {
    return this.timeEntriesService.findOne(id);
  }

  @Post()
  @RequirePermissions('tasks.update')
  create(@Body() dto: CreateTimeEntryDto, @Req() req: RequestWithUser) {
    return this.timeEntriesService.create(dto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions('tasks.update')
  update(@Param('id') id: string, @Body() dto: UpdateTimeEntryDto) {
    return this.timeEntriesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tasks.update')
  remove(@Param('id') id: string) {
    return this.timeEntriesService.remove(id);
  }

  @Patch(':id/validate')
  @RequirePermissions('tasks.update')
  validate(@Param('id') id: string) {
    return this.timeEntriesService.validate(id);
  }
}
```

### Step 6: `apps/api/src/time-entries/time-entries.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntriesController } from './time-entries.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
```

**Commit:**
```bash
git add apps/api/src/time-entries
git commit -m "feat(api): add TimeEntriesModule with 24h daily cap validation"
```

---

## Task 6: Register modules in AppModule

**File to edit:** `apps/api/src/app.module.ts`

Add the three new imports:

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
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**Commit:**
```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register ProjectsModule, TasksModule, TimeEntriesModule in AppModule"
```

---
## Task 7: Next.js API client helpers

**Files to create:**
- `apps/web/src/lib/api/projects.ts`
- `apps/web/src/lib/api/tasks.ts`
- `apps/web/src/lib/api/time-entries.ts`

### Step 1: `apps/web/src/lib/api/projects.ts`

```typescript
import { apiRequest } from './client';

export interface ProjectListItem {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  clientId: string;
  client: { id: string; name: string; logoUrl: string | null };
  operator: { id: string; name: string } | null;
  responsible: { id: string; firstName: string; lastName: string } | null;
  status: string;
  priority: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  budgetHours: string | null;
  isActive: boolean;
  advancement: number;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  _count: { tasks: number };
  createdAt: string;
}

export interface ProjectDetail extends ProjectListItem {
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null;
  customFieldsConfig: Record<string, unknown> | null;
  tasks: TaskSummary[];
  _count: { tasks: number; demands: number; attachments: number };
}

export interface TaskSummary {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  facturable: boolean;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  employee: { id: string; firstName: string; lastName: string } | null;
  codeProduit: { id: string; code: string; designation: string } | null;
  _count: { timeEntries: number; comments: number };
}

export interface ProjectListResponse {
  data: ProjectListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ProjectStats {
  active: number;
  inProgress: number;
  avgAdvancement: number;
  overdue: number;
}

type ProjectParams = {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: string;
  operatorId?: string;
  responsibleId?: string;
  status?: string;
  priority?: string;
  isActive?: boolean;
};

export const projectsApi = {
  list: (params: ProjectParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<ProjectListResponse>(`/projects?${qs}`);
  },

  getOne: (id: string) => apiRequest<ProjectDetail>(`/projects/${id}`),

  getStats: () => apiRequest<ProjectStats>('/projects/stats'),

  create: (data: Record<string, unknown>) =>
    apiRequest<ProjectListItem>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<ProjectListItem>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/projects/${id}`, { method: 'DELETE' }),
};
```

### Step 2: `apps/web/src/lib/api/tasks.ts`

```typescript
import { apiRequest } from './client';

export interface TaskListItem {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  projectId: string;
  project: { id: string; reference: string; title: string };
  site: { id: string; name: string } | null;
  employee: { id: string; firstName: string; lastName: string } | null;
  codeProduit: { id: string; code: string; designation: string; timeGamme: string | null } | null;
  status: string;
  priority: string;
  facturable: boolean;
  dateReception: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  estimatedHours: string | null;
  budgetHours: string | null;
  deliverableLinks: string[];
  customFieldsData: Record<string, unknown> | null;
  delaiRL: number | null;
  rendement: number | null;
  totalHours: number;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  _count: { comments: number; deliverables: number };
  createdAt: string;
  updatedAt: string;
}

export interface TaskDeliverable {
  id: string;
  taskId: string;
  url: string;
  type: string | null;
  label: string | null;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  author: { id: string; email: string };
  content: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryItem {
  id: string;
  taskId: string;
  userId: string;
  user: { id: string; email: string };
  previousStatus: string;
  newStatus: string;
  changedAt: string;
  comment: string | null;
}

export interface TimeEntryItem {
  id: string;
  taskId: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string };
  userId: string;
  date: string;
  hours: string;
  comment: string | null;
  isValidated: boolean;
  createdAt: string;
}

export interface TaskDetail extends TaskListItem {
  demand: { id: string; quantity: number } | null;
  timeEntries: TimeEntryItem[];
  comments: TaskComment[];
  statusHistory: StatusHistoryItem[];
  deliverables: TaskDeliverable[];
}

export interface TaskListResponse {
  data: TaskListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface TaskStats {
  total: number;
  inProgress: number;
  doneThisMonth: number;
  avgRendement: number;
}

type TaskParams = {
  page?: number;
  limit?: number;
  search?: string;
  projectId?: string;
  siteId?: string;
  employeeId?: string;
  codeProduitId?: string;
  status?: string;
  facturable?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

export const tasksApi = {
  list: (params: TaskParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<TaskListResponse>(`/tasks?${qs}`);
  },

  getOne: (id: string) => apiRequest<TaskDetail>(`/tasks/${id}`),

  getStats: () => apiRequest<TaskStats>('/tasks/stats'),

  create: (data: Record<string, unknown>) =>
    apiRequest<TaskListItem>('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<TaskDetail>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/tasks/${id}`, { method: 'DELETE' }),

  addDeliverable: (taskId: string, data: { url: string; type?: string; label?: string }) =>
    apiRequest<TaskDeliverable>(`/tasks/${taskId}/deliverables`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeDeliverable: (taskId: string, deliverableId: string) =>
    apiRequest(`/tasks/${taskId}/deliverables/${deliverableId}`, { method: 'DELETE' }),

  addComment: (taskId: string, data: { content: string; attachments?: string[] }) =>
    apiRequest<TaskComment>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteComment: (taskId: string, commentId: string) =>
    apiRequest(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),
};
```

### Step 3: `apps/web/src/lib/api/time-entries.ts`

```typescript
import { apiRequest } from './client';
import type { TimeEntryItem } from './tasks';

export interface TimeEntryListResponse {
  data: TimeEntryItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

type TimeEntryParams = {
  page?: number;
  limit?: number;
  taskId?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  isValidated?: boolean;
};

export const timeEntriesApi = {
  list: (params: TimeEntryParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<TimeEntryListResponse>(`/time-entries?${qs}`);
  },

  getOne: (id: string) => apiRequest<TimeEntryItem>(`/time-entries/${id}`),

  create: (data: { taskId: string; employeeId: string; date: string; hours: number; comment?: string }) =>
    apiRequest<TimeEntryItem>('/time-entries', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { date?: string; hours?: number; comment?: string }) =>
    apiRequest<TimeEntryItem>(`/time-entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/time-entries/${id}`, { method: 'DELETE' }),

  validate: (id: string) =>
    apiRequest<TimeEntryItem>(`/time-entries/${id}/validate`, { method: 'PATCH' }),
};
```

**Commit:**
```bash
git add apps/web/src/lib/api/projects.ts apps/web/src/lib/api/tasks.ts apps/web/src/lib/api/time-entries.ts
git commit -m "feat(web): add API client helpers for projects, tasks, and time-entries"
```

---
## Task 8: Next.js /projects page

**Files to create:**
- `apps/web/src/app/(app)/projects/page.tsx`
- `apps/web/src/app/(app)/projects/projects-client.tsx`
- `apps/web/src/app/(app)/projects/project-form-dialog.tsx`

### Step 1: `apps/web/src/app/(app)/projects/page.tsx`

```typescript
import { Header } from '@/components/layout/header';
import { ProjectsClient } from './projects-client';

export const metadata = { title: 'Projets' };

export default function ProjectsPage() {
  return (
    <>
      <Header title="Projets" />
      <div className="p-6 space-y-6">
        <ProjectsClient />
      </div>
    </>
  );
}
```

### Step 2: `apps/web/src/app/(app)/projects/projects-client.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, type ProjectListItem } from '@/lib/api/projects';
import { StatsBar } from '@exeteam/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FolderKanban, Plus, MoreHorizontal, Search, Clock, TrendingUp, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';
import { ProjectFormDialog } from './project-form-dialog';

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  a_traiter: 'bg-yellow-100 text-yellow-800',
  en_cours: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-purple-100 text-purple-800',
  terminee: 'bg-green-100 text-green-800',
  livree: 'bg-emerald-100 text-emerald-800',
  annulee: 'bg-red-100 text-red-700',
};

const PRIORITY_LABELS: Record<string, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  basse: 'bg-slate-100 text-slate-600',
  normale: 'bg-blue-50 text-blue-700',
  haute: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

export function ProjectsClient() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['projects', 'stats'],
    queryFn: () => projectsApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'list', { search: debouncedSearch, status, priority, page }],
    queryFn: () =>
      projectsApi.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        priority: priority || undefined,
        page,
        limit: 20,
      }),
  });

  const statsItems = [
    { label: 'Projets actifs', value: stats?.active ?? '—', icon: FolderKanban },
    { label: 'En cours', value: stats?.inProgress ?? '—', icon: Clock },
    { label: 'Avancement moyen', value: stats ? `${stats.avgAdvancement}%` : '—', icon: TrendingUp },
    { label: 'En retard', value: stats?.overdue ?? '—', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => { setPriority(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)} style={{ backgroundColor: '#FF6600' }}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau projet
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Avancement</TableHead>
              <TableHead>Dates prévues</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Aucun projet trouvé
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((project: ProjectListItem) => (
                <TableRow key={project.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/projects/${project.id}`} className="font-mono text-sm text-primary hover:underline">
                      {project.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/projects/${project.id}`} className="font-medium hover:text-primary">
                      {project.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.client.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.responsible
                      ? `${project.responsible.firstName} ${project.responsible.lastName}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[project.priority] ?? ''}`}>
                      {PRIORITY_LABELS[project.priority] ?? project.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden w-20">
                        <div
                          className="h-full bg-[#FF6600] rounded-full transition-all"
                          style={{ width: `${project.advancement}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-9">{project.advancement}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {project.plannedStartDate
                      ? new Date(project.plannedStartDate).toLocaleDateString('fr-FR')
                      : '—'}
                    {' → '}
                    {project.plannedEndDate
                      ? new Date(project.plannedEndDate).toLocaleDateString('fr-FR')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${project.id}`}>Voir le détail</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${project.id}?tab=infos`}>Modifier</Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data.total} projets au total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="flex items-center px-3">Page {page} / {data.pages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
```

### Step 3: `apps/web/src/app/(app)/projects/project-form-dialog.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Requis'),
  clientId: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  status: z.string().default('brouillon'),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  budgetHours: z.coerce.number().nonnegative().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  projectId?: string;
}

export function ProjectFormDialog({ open, onOpenChange, defaultValues, projectId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!projectId;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'brouillon', priority: 'normale', ...defaultValues },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit ? projectsApi.update(projectId!, data) : projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le projet' : 'Nouveau projet'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Titre *</FormLabel>
                <FormControl><Input placeholder="Titre du projet" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="clientId" render={({ field }) => (
              <FormItem>
                <FormLabel>Client ID *</FormLabel>
                <FormControl><Input placeholder="UUID du client" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Description du projet..." rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="brouillon">Brouillon</SelectItem>
                      <SelectItem value="a_traiter">À traiter</SelectItem>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="en_revision">En révision</SelectItem>
                      <SelectItem value="terminee">Terminée</SelectItem>
                      <SelectItem value="livree">Livrée</SelectItem>
                      <SelectItem value="annulee">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorité</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="basse">Basse</SelectItem>
                      <SelectItem value="normale">Normale</SelectItem>
                      <SelectItem value="haute">Haute</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="plannedStartDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Début prévu</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="plannedEndDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fin prévue</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="budgetHours" render={({ field }) => (
              <FormItem>
                <FormLabel>Budget heures</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.5} placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {mutation.error && (
              <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/projects
git commit -m "feat(web): add /projects list page with StatsBar, filters, and DataTable"
```

---
## Task 9: Next.js /projects/[id] detail page

**Files to create:**
- `apps/web/src/app/(app)/projects/[id]/page.tsx`
- `apps/web/src/app/(app)/projects/[id]/project-detail-client.tsx`
- `apps/web/src/app/(app)/projects/[id]/tabs/project-infos-tab.tsx`
- `apps/web/src/app/(app)/projects/[id]/tabs/project-tasks-tab.tsx`
- `apps/web/src/app/(app)/projects/[id]/tabs/project-gantt-tab.tsx`
- `apps/web/src/app/(app)/projects/[id]/tabs/project-custom-fields-tab.tsx`
- `apps/web/src/app/(app)/projects/[id]/tabs/project-commercial-tab.tsx`
- `apps/web/src/app/(app)/projects/[id]/tabs/project-historique-tab.tsx`

### Step 1: `apps/web/src/app/(app)/projects/[id]/page.tsx`

```typescript
import { Header } from '@/components/layout/header';
import { ProjectDetailClient } from './project-detail-client';

interface Props {
  params: { id: string };
  searchParams: { tab?: string };
}

export const metadata = { title: 'Détail projet' };

export default function ProjectDetailPage({ params, searchParams }: Props) {
  return (
    <>
      <Header title="Détail projet" />
      <div className="p-6">
        <ProjectDetailClient id={params.id} defaultTab={searchParams.tab ?? 'infos'} />
      </div>
    </>
  );
}
```

### Step 2: `apps/web/src/app/(app)/projects/[id]/project-detail-client.tsx`

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { ProjectInfosTab } from './tabs/project-infos-tab';
import { ProjectTasksTab } from './tabs/project-tasks-tab';
import { ProjectGanttTab } from './tabs/project-gantt-tab';
import { ProjectCustomFieldsTab } from './tabs/project-custom-fields-tab';
import { ProjectCommercialTab } from './tabs/project-commercial-tab';
import { ProjectHistoriqueTab } from './tabs/project-historique-tab';

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  a_traiter: 'bg-yellow-100 text-yellow-800',
  en_cours: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-purple-100 text-purple-800',
  terminee: 'bg-green-100 text-green-800',
  livree: 'bg-emerald-100 text-emerald-800',
  annulee: 'bg-red-100 text-red-700',
};

interface Props {
  id: string;
  defaultTab: string;
}

export function ProjectDetailClient({ id, defaultTab }: Props) {
  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.getOne(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Projet introuvable
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Retour aux projets
          </Link>
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-[#FF6600]" />
            <h2 className="text-xl font-semibold">{project.title}</h2>
            <span className="font-mono text-sm text-muted-foreground">{project.reference}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {project.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{project.client.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto">
          {[
            { value: 'infos', label: 'Infos' },
            { value: 'taches', label: 'Tâches' },
            { value: 'gantt', label: 'Gantt' },
            { value: 'custom-fields', label: 'Champs personnalisés' },
            { value: 'commercial', label: 'Commercial' },
            { value: 'historique', label: 'Historique' },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF6600] data-[state=active]:text-[#FF6600] data-[state=active]:shadow-none pb-3 px-4"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="infos">
            <ProjectInfosTab project={project} />
          </TabsContent>
          <TabsContent value="taches">
            <ProjectTasksTab project={project} />
          </TabsContent>
          <TabsContent value="gantt">
            <ProjectGanttTab project={project} />
          </TabsContent>
          <TabsContent value="custom-fields">
            <ProjectCustomFieldsTab project={project} />
          </TabsContent>
          <TabsContent value="commercial">
            <ProjectCommercialTab project={project} />
          </TabsContent>
          <TabsContent value="historique">
            <ProjectHistoriqueTab project={project} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

### Step 3: `apps/web/src/app/(app)/projects/[id]/tabs/project-infos-tab.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, type ProjectDetail } from '@/lib/api/projects';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  status: z.string(),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  actualStartDate: z.string().optional(),
  actualEndDate: z.string().optional(),
  budgetHours: z.coerce.number().nonnegative().optional(),
});

type FormValues = z.infer<typeof schema>;

function toDateInputValue(val: string | null | undefined): string {
  if (!val) return '';
  return val.split('T')[0];
}

interface Props {
  project: ProjectDetail;
}

export function ProjectInfosTab({ project }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: project.title,
      description: project.description ?? '',
      status: project.status,
      priority: project.priority as FormValues['priority'],
      plannedStartDate: toDateInputValue(project.plannedStartDate),
      plannedEndDate: toDateInputValue(project.plannedEndDate),
      actualStartDate: toDateInputValue(project.actualStartDate),
      actualEndDate: toDateInputValue(project.actualEndDate),
      budgetHours: project.budgetHours ? Number(project.budgetHours) : undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => projectsApi.update(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations générales</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Description du projet..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="brouillon">Brouillon</SelectItem>
                          <SelectItem value="a_traiter">À traiter</SelectItem>
                          <SelectItem value="en_cours">En cours</SelectItem>
                          <SelectItem value="en_revision">En révision</SelectItem>
                          <SelectItem value="terminee">Terminée</SelectItem>
                          <SelectItem value="livree">Livrée</SelectItem>
                          <SelectItem value="annulee">Annulée</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priorité</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="basse">Basse</SelectItem>
                          <SelectItem value="normale">Normale</SelectItem>
                          <SelectItem value="haute">Haute</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="plannedStartDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Début prévu</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="plannedEndDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fin prévue</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="actualStartDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Début réel</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="actualEndDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fin réelle</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="budgetHours" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget heures</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {mutation.error && (
                  <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
                )}

                {mutation.isSuccess && (
                  <p className="text-sm text-green-600">Modifications enregistrées</p>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <Save className="h-4 w-4 mr-2" />}
                    Enregistrer
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intervenants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Client</p>
              <p className="font-medium">{project.client.name}</p>
            </div>
            {project.operator && (
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Opérateur</p>
                <p className="font-medium">{project.operator.name}</p>
              </div>
            )}
            {project.responsible && (
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Responsable</p>
                <p className="font-medium">
                  {project.responsible.firstName} {project.responsible.lastName}
                </p>
              </div>
            )}
            {project.contact && (
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Contact client</p>
                <p className="font-medium">
                  {project.contact.firstName} {project.contact.lastName}
                </p>
                {project.contact.email && (
                  <p className="text-muted-foreground">{project.contact.email}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tâches totales</span>
              <span className="font-medium">{project._count.tasks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Demandes</span>
              <span className="font-medium">{project._count.demands}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pièces jointes</span>
              <span className="font-medium">{project._count.attachments}</span>
            </div>
            {project.budgetHours && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Budget heures</span>
                <span className="font-medium">{project.budgetHours}h</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### Step 4: `apps/web/src/app/(app)/projects/[id]/tabs/project-tasks-tab.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, type TaskListItem } from '@/lib/api/tasks';
import { projectsApi, type ProjectDetail, type TaskSummary } from '@/lib/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, LayoutList, Columns, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';

const STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  a_traiter: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  en_cours: 'bg-blue-100 text-blue-800 border-blue-200',
  en_revision: 'bg-purple-100 text-purple-800 border-purple-200',
  terminee: 'bg-green-100 text-green-800 border-green-200',
  livree: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  annulee: 'bg-red-50 text-red-700 border-red-200',
};

const KANBAN_COLUMNS = ['a_traiter', 'en_cours', 'en_revision', 'terminee', 'livree'];

interface Props {
  project: ProjectDetail;
}

export function ProjectTasksTab({ project }: Props) {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Get statuses from project config if overridden
  const configStatuses =
    project.customFieldsConfig &&
    typeof project.customFieldsConfig === 'object' &&
    Array.isArray((project.customFieldsConfig as Record<string, unknown>)['statuses'])
      ? ((project.customFieldsConfig as Record<string, unknown>)['statuses'] as string[])
      : KANBAN_COLUMNS;

  const tasks = project.tasks.filter((t: TaskSummary) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q);
  });

  const tasksByStatus = configStatuses.reduce<Record<string, TaskSummary[]>>((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une tâche..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('kanban')}
            >
              <Columns className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Link href={`/tasks/new?projectId=${project.id}`}>
          <Button style={{ backgroundColor: '#FF6600' }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle tâche
          </Button>
        </Link>
      </div>

      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {configStatuses.map((status) => {
            const colTasks = tasksByStatus[status] ?? [];
            return (
              <div key={status} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                </div>
                <div className="space-y-2 min-h-24">
                  {colTasks.map((task) => (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <div className="bg-card border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">{task.reference}</p>
                        {task.employee && (
                          <p className="text-xs text-muted-foreground">
                            {task.employee.firstName} {task.employee.lastName}
                          </p>
                        )}
                        {task.codeProduit && (
                          <Badge variant="outline" className="text-xs">
                            {task.codeProduit.code}
                          </Badge>
                        )}
                        {task.facturable && (
                          <Badge className="text-xs bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20">
                            Facturable
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                      Aucune tâche
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Aucune tâche pour ce projet
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/tasks/${task.id}`} className="font-medium text-sm hover:text-primary truncate">
                      {task.title}
                    </Link>
                    <span className="text-xs font-mono text-muted-foreground">{task.reference}</span>
                  </div>
                  {task.employee && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {task.employee.firstName} {task.employee.lastName}
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
                {task.facturable && (
                  <Badge variant="outline" className="text-xs border-[#FF6600]/40 text-[#FF6600]">
                    Facturable
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 5: `apps/web/src/app/(app)/projects/[id]/tabs/project-gantt-tab.tsx`

```typescript
'use client';

import dynamic from 'next/dynamic';
import { type ProjectDetail } from '@/lib/api/projects';

// Frappe Gantt must be rendered client-side only (no SSR)
const FrappeGanttWrapper = dynamic(() => import('./gantt-wrapper'), { ssr: false });

interface Props {
  project: ProjectDetail;
}

export function ProjectGanttTab({ project }: Props) {
  const tasks = project.tasks
    .filter((t) => t.plannedStartDate && t.plannedEndDate)
    .map((t) => ({
      id: t.id,
      name: `${t.reference} — ${t.title}`,
      start: t.plannedStartDate!.split('T')[0],
      end: t.plannedEndDate!.split('T')[0],
      progress: ['terminee', 'livree'].includes(t.status) ? 100 : t.status === 'en_cours' ? 50 : 0,
      dependencies: '',
    }));

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
        Aucune tâche avec des dates prévues à afficher dans le Gantt
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Affichage des {tasks.length} tâches avec des dates planifiées.
      </p>
      <div className="border rounded-lg overflow-hidden bg-card">
        <FrappeGanttWrapper tasks={tasks} />
      </div>
    </div>
  );
}
```

### Step 6: `apps/web/src/app/(app)/projects/[id]/tabs/gantt-wrapper.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';
import 'frappe-gantt/dist/frappe-gantt.css';

interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string;
}

interface Props {
  tasks: GanttTask[];
}

export default function GanttWrapper({ tasks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<InstanceType<typeof Gantt> | null>(null);

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return;

    // Clear previous render
    containerRef.current.innerHTML = '';

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    containerRef.current.appendChild(svgEl);

    ganttRef.current = new Gantt(svgEl, tasks, {
      view_mode: 'Week',
      date_format: 'YYYY-MM-DD',
      language: 'fr',
      custom_popup_html: (task: GanttTask) => `
        <div class="p-2 text-sm">
          <strong>${task.name}</strong><br/>
          ${task.start} → ${task.end}<br/>
          Avancement: ${task.progress}%
        </div>
      `,
    });

    return () => {
      ganttRef.current = null;
    };
  }, [tasks]);

  return (
    <div ref={containerRef} className="p-4 overflow-x-auto min-h-64" />
  );
}
```

### Step 7: `apps/web/src/app/(app)/projects/[id]/tabs/project-custom-fields-tab.tsx`

```typescript
'use client';

import { type ProjectDetail } from '@/lib/api/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  project: ProjectDetail;
}

export function ProjectCustomFieldsTab({ project }: Props) {
  if (!project.customFieldsConfig) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
        Aucun champ personnalisé configuré pour ce projet.
        Configurez-les depuis la section Champs Personnalisés (Sprint 2C).
      </div>
    );
  }

  const config = project.customFieldsConfig as Record<string, unknown>;
  const fields = Array.isArray(config['fields'])
    ? (config['fields'] as Array<{ key: string; label: string; type: string }>)
    : [];

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
        La configuration ne contient pas de champs définis.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Champs personnalisés du projet</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Les champs personnalisés sont gérés via le composant DynamicForm (Sprint 2C).
          Intégrez le composant <code className="bg-muted px-1 rounded">DynamicForm</code> ici
          avec <code className="bg-muted px-1 rounded">config={JSON.stringify(config)}</code>.
        </p>
        <div className="mt-4 space-y-2">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.type}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 8: `apps/web/src/app/(app)/projects/[id]/tabs/project-commercial-tab.tsx`

```typescript
'use client';

import { type ProjectDetail } from '@/lib/api/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface Props {
  project: ProjectDetail;
}

export function ProjectCommercialTab({ project }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <TrendingUp className="h-12 w-12 opacity-30" />
      <div className="text-center">
        <p className="font-medium">Onglet Commercial</p>
        <p className="text-sm mt-1">
          Cette section sera implémentée dans Sprint 3C (Commercial & Devis).
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Projet: {project.reference} — {project._count.demands} demande(s) liée(s)
        </p>
      </div>
    </div>
  );
}
```

### Step 9: `apps/web/src/app/(app)/projects/[id]/tabs/project-historique-tab.tsx`

```typescript
'use client';

import { type ProjectDetail } from '@/lib/api/projects';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface Props {
  project: ProjectDetail;
}

export function ProjectHistoriqueTab({ project }: Props) {
  // Future: fetch audit log entries for this project
  const events = [
    {
      id: '1',
      label: 'Projet créé',
      date: project.createdAt,
      description: `Référence ${project.reference} générée`,
    },
  ];

  return (
    <div className="space-y-3">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6600]/10 text-[#FF6600]">
              <Clock className="h-4 w-4" />
            </div>
            {i < events.length - 1 && (
              <div className="flex-1 w-px bg-border mt-2" />
            )}
          </div>
          <div className="pb-6">
            <p className="text-sm font-medium">{event.label}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(event.date).toLocaleString('fr-FR')}
            </p>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/projects/\[id\]
git commit -m "feat(web): add /projects/[id] detail page with 6 tabs including Kanban and Gantt"
```

---
## Task 10: Next.js /tasks page

**Files to create:**
- `apps/web/src/app/(app)/tasks/page.tsx`
- `apps/web/src/app/(app)/tasks/tasks-client.tsx`
- `apps/web/src/app/(app)/tasks/task-form-dialog.tsx`

### Step 1: `apps/web/src/app/(app)/tasks/page.tsx`

```typescript
import { Header } from '@/components/layout/header';
import { TasksClient } from './tasks-client';

export const metadata = { title: 'Tâches' };

export default function TasksPage() {
  return (
    <>
      <Header title="Tâches" />
      <div className="p-6 space-y-6">
        <TasksClient />
      </div>
    </>
  );
}
```

### Step 2: `apps/web/src/app/(app)/tasks/tasks-client.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksApi, type TaskListItem } from '@/lib/api/tasks';
import { StatsBar } from '@exeteam/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CheckSquare, Clock, TrendingUp, Plus, Search, MoreHorizontal, Activity,
} from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';
import { TaskFormDialog } from './task-form-dialog';

const STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  a_traiter: 'bg-yellow-100 text-yellow-800',
  en_cours: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-purple-100 text-purple-800',
  terminee: 'bg-green-100 text-green-800',
  livree: 'bg-emerald-100 text-emerald-800',
  annulee: 'bg-red-50 text-red-700',
};

export function TasksClient() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [facturable, setFacturable] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['tasks', 'stats'],
    queryFn: () => tasksApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'list', { search: debouncedSearch, status, facturable, page }],
    queryFn: () =>
      tasksApi.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        facturable: facturable === '' ? undefined : facturable === 'true',
        page,
        limit: 25,
      }),
  });

  const statsItems = [
    { label: 'Total tâches', value: stats?.total ?? '—', icon: CheckSquare },
    { label: 'En cours', value: stats?.inProgress ?? '—', icon: Clock },
    { label: 'Terminées ce mois', value: stats?.doneThisMonth ?? '—', icon: Activity },
    {
      label: 'Taux rendement moy.',
      value: stats ? `${stats.avgRendement}%` : '—',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une tâche..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={facturable} onValueChange={(v) => { setFacturable(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Facturable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="true">Facturable</SelectItem>
              <SelectItem value="false">Non facturable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)} style={{ backgroundColor: '#FF6600' }}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle tâche
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Assigné</TableHead>
              <TableHead>Code produit</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Facturable</TableHead>
              <TableHead>Délai R→L</TableHead>
              <TableHead>Rendement</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Aucune tâche trouvée
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((task: TaskListItem) => (
                <TableRow key={task.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/tasks/${task.id}`} className="font-mono text-xs text-primary hover:underline">
                      {task.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/tasks/${task.id}`} className="font-medium text-sm hover:text-primary">
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <Link href={`/projects/${task.project.id}`} className="hover:text-primary">
                      {task.project.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.site?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.employee
                      ? `${task.employee.firstName} ${task.employee.lastName}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {task.codeProduit ? (
                      <Badge variant="outline" className="text-xs font-mono">
                        {task.codeProduit.code}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {task.facturable ? (
                      <Badge className="bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20 text-xs">
                        Oui
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {task.delaiRL !== null ? (
                      <span className={task.delaiRL > 10 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {task.delaiRL}j
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {task.rendement !== null ? (
                      <span className={
                        task.rendement >= 90
                          ? 'text-green-600 font-medium'
                          : task.rendement >= 70
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }>
                        {task.rendement}%
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/tasks/${task.id}`}>Voir le détail</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${task.project.id}?tab=taches`}>
                            Voir le projet
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data.total} tâches au total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="flex items-center px-3">Page {page} / {data.pages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
```

### Step 3: `apps/web/src/app/(app)/tasks/task-form-dialog.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Requis'),
  projectId: z.string().min(1, 'Requis'),
  codeProduitId: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  status: z.string().default('a_traiter'),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  dateReception: z.string().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  estimatedHours: z.coerce.number().nonnegative().optional(),
  facturable: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  taskId?: string;
}

export function TaskFormDialog({ open, onOpenChange, defaultValues, taskId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!taskId;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'a_traiter',
      priority: 'normale',
      facturable: true,
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit ? tasksApi.update(taskId!, data) : tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Titre *</FormLabel>
                <FormControl><Input placeholder="Titre de la tâche" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Projet ID *</FormLabel>
                  <FormControl><Input placeholder="UUID du projet" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="codeProduitId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code produit ID *</FormLabel>
                  <FormControl><Input placeholder="UUID du code produit" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Description..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="a_traiter">À traiter</SelectItem>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="en_revision">En révision</SelectItem>
                      <SelectItem value="terminee">Terminée</SelectItem>
                      <SelectItem value="livree">Livrée</SelectItem>
                      <SelectItem value="annulee">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorité</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="basse">Basse</SelectItem>
                      <SelectItem value="normale">Normale</SelectItem>
                      <SelectItem value="haute">Haute</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="dateReception" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date réception</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estimatedHours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Heures estimées</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step={0.5} placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="plannedStartDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Début prévu</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="plannedEndDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fin prévue</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="facturable" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">Tâche facturable</FormLabel>
              </FormItem>
            )} />

            {mutation.error && (
              <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/tasks/page.tsx apps/web/src/app/\(app\)/tasks/tasks-client.tsx apps/web/src/app/\(app\)/tasks/task-form-dialog.tsx
git commit -m "feat(web): add /tasks list page with StatsBar, filters, Délai R→L and Rendement columns"
```

---
## Task 11: Next.js /tasks/[id] full detail page

**Files to create:**
- `apps/web/src/app/(app)/tasks/[id]/page.tsx`
- `apps/web/src/app/(app)/tasks/[id]/task-detail-client.tsx`
- `apps/web/src/app/(app)/tasks/[id]/time-entry-form-dialog.tsx`
- `apps/web/src/app/(app)/tasks/[id]/add-deliverable-dialog.tsx`

### Step 1: `apps/web/src/app/(app)/tasks/[id]/page.tsx`

```typescript
import { Header } from '@/components/layout/header';
import { TaskDetailClient } from './task-detail-client';

interface Props {
  params: { id: string };
}

export const metadata = { title: 'Détail tâche' };

export default function TaskDetailPage({ params }: Props) {
  return (
    <>
      <Header title="Détail tâche" />
      <div className="p-6">
        <TaskDetailClient id={params.id} />
      </div>
    </>
  );
}
```

### Step 2: `apps/web/src/app/(app)/tasks/[id]/task-detail-client.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, type TaskDetail, type TaskComment, type StatusHistoryItem } from '@/lib/api/tasks';
import { timeEntriesApi } from '@/lib/api/time-entries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Clock, Link2, MessageSquare, Plus, Trash2, CheckCircle, Activity,
  User, MapPin, Wrench, Calendar, Timer, TrendingUp, Tag, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { TimeEntryFormDialog } from './time-entry-form-dialog';
import { AddDeliverableDialog } from './add-deliverable-dialog';

const STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  a_traiter: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  en_cours: 'bg-blue-100 text-blue-800 border-blue-200',
  en_revision: 'bg-purple-100 text-purple-800 border-purple-200',
  terminee: 'bg-green-100 text-green-800 border-green-200',
  livree: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  annulee: 'bg-red-50 text-red-700 border-red-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  basse: 'bg-slate-100 text-slate-600',
  normale: 'bg-blue-50 text-blue-700',
  haute: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

const DELIVERABLE_TYPE_ICONS: Record<string, string> = {
  sharepoint: 'SharePoint',
  onedrive: 'OneDrive',
  dropbox: 'Dropbox',
  gdrive: 'Google Drive',
  url: 'Lien',
};

interface TimelineEvent {
  id: string;
  type: 'comment' | 'status';
  date: string;
  actor: string;
  content: string;
  extra?: string;
}

function buildTimeline(task: TaskDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const c of task.comments) {
    events.push({
      id: `comment-${c.id}`,
      type: 'comment',
      date: c.createdAt,
      actor: c.author.email,
      content: c.content,
    });
  }

  for (const s of task.statusHistory) {
    events.push({
      id: `status-${s.id}`,
      type: 'status',
      date: s.changedAt,
      actor: s.user.email,
      content: `Statut changé de "${STATUS_LABELS[s.previousStatus] ?? s.previousStatus}" à "${STATUS_LABELS[s.newStatus] ?? s.newStatus}"`,
      extra: s.comment ?? undefined,
    });
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

interface Props {
  id: string;
}

export function TaskDetailClient({ id }: Props) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [timeEntryOpen, setTimeEntryOpen] = useState(false);
  const [deliverableOpen, setDeliverableOpen] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksApi.getOne(id),
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => tasksApi.update(id, { status: newStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => tasksApi.addComment(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      setComment('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(id, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  });

  const removeDeliverableMutation = useMutation({
    mutationFn: (deliverableId: string) => tasksApi.removeDeliverable(id, deliverableId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  });

  const deleteTimeEntryMutation = useMutation({
    mutationFn: (entryId: string) => timeEntriesApi.delete(entryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Tâche introuvable
      </div>
    );
  }

  const timeline = buildTimeline(task);
  const totalHours = task.timeEntries.reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour aux tâches
        </Link>
      </div>

      {/* Header bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{task.reference}</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? ''}`}>
              {task.priority}
            </span>
            {task.facturable && (
              <Badge className="bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
                Facturable
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-semibold">{task.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={task.status}
            onValueChange={(v) => statusMutation.mutate(v)}
            disabled={statusMutation.isPending}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a_traiter">À traiter</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="en_revision">En révision</SelectItem>
              <SelectItem value="terminee">Terminée</SelectItem>
              <SelectItem value="livree">Livrée</SelectItem>
              <SelectItem value="annulee">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {statusMutation.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {(statusMutation.error as Error).message}
        </p>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {task.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Custom fields data */}
          {task.customFieldsData && Object.keys(task.customFieldsData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Champs personnalisés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(task.customFieldsData).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-1 border-b last:border-0">
                      <span className="text-sm font-medium text-muted-foreground">{key}</span>
                      <span className="text-sm">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deliverables */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Livrables ({task.deliverables.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDeliverableOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              {task.deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun livrable. Ajoutez un lien pour pouvoir passer la tâche en "Terminée".
                </p>
              ) : (
                <div className="space-y-2">
                  {task.deliverables.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {d.label ?? d.url}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {d.type ? DELIVERABLE_TYPE_ICONS[d.type] ?? d.type : 'Lien'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeDeliverableMutation.mutate(d.id)}
                          disabled={removeDeliverableMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline: Status history + Comments interleaved */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Historique & Commentaires
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun événement</p>
              ) : (
                <div className="space-y-4">
                  {timeline.map((event, i) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                          event.type === 'comment'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-[#FF6600]/10 text-[#FF6600]'
                        }`}>
                          {event.type === 'comment'
                            ? <MessageSquare className="h-4 w-4" />
                            : <Activity className="h-4 w-4" />}
                        </div>
                        {i < timeline.length - 1 && (
                          <div className="flex-1 w-px bg-border my-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{event.actor}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{event.content}</p>
                        {event.extra && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">{event.extra}</p>
                        )}
                        {event.type === 'comment' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-6 px-2 mt-1 text-xs"
                            onClick={() => {
                              const commentId = event.id.replace('comment-', '');
                              deleteCommentMutation.mutate(commentId);
                            }}
                            disabled={deleteCommentMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Supprimer
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment form */}
              <Separator />
              <div className="space-y-2">
                <Textarea
                  placeholder="Ajouter un commentaire..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!comment.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate(comment.trim())}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Commenter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time entries panel */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Saisies de temps ({task.timeEntries.length} entrées — {totalHours.toFixed(1)}h total)
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setTimeEntryOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Saisir du temps
              </Button>
            </CardHeader>
            <CardContent>
              {task.timeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune saisie de temps enregistrée
                </p>
              ) : (
                <div className="divide-y">
                  {task.timeEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {entry.employee.firstName} {entry.employee.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString('fr-FR')}
                          </span>
                          {entry.isValidated && (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                        {entry.comment && (
                          <p className="text-xs text-muted-foreground mt-0.5">{entry.comment}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[#FF6600]">
                          {Number(entry.hours).toFixed(1)}h
                        </span>
                        {!entry.isValidated && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteTimeEntryMutation.mutate(entry.id)}
                            disabled={deleteTimeEntryMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar (1/3) */}
        <div className="space-y-4">
          {/* Assignee & relations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Détails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {task.employee && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assigné à</p>
                    <p className="font-medium">
                      {task.employee.firstName} {task.employee.lastName}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Activity className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Projet</p>
                  <Link
                    href={`/projects/${task.project.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {task.project.reference}
                  </Link>
                  <p className="text-xs text-muted-foreground">{task.project.title}</p>
                </div>
              </div>

              {task.site && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Site</p>
                    <p className="font-medium">{task.site.name}</p>
                  </div>
                </div>
              )}

              {task.codeProduit && (
                <div className="flex items-start gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Code produit</p>
                    <p className="font-medium font-mono">{task.codeProduit.code}</p>
                    <p className="text-xs text-muted-foreground">{task.codeProduit.designation}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: 'Réception', value: task.dateReception },
                { label: 'Début prévu', value: task.plannedStartDate },
                { label: 'Fin prévue', value: task.plannedEndDate },
                { label: 'Début réel', value: task.actualStartDate },
                { label: 'Fin réelle', value: task.actualEndDate },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">
                    {value ? new Date(value).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Hours & KPIs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Heures & KPIs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimées</span>
                <span className="font-medium">
                  {task.estimatedHours ? `${Number(task.estimatedHours).toFixed(1)}h` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Réelles</span>
                <span className="font-medium text-[#FF6600]">{totalHours.toFixed(1)}h</span>
              </div>
              {task.estimatedHours && totalHours > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Consommation</span>
                    <span>{Math.round((totalHours / Number(task.estimatedHours)) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        totalHours > Number(task.estimatedHours) ? 'bg-red-500' : 'bg-[#FF6600]'
                      }`}
                      style={{
                        width: `${Math.min(100, (totalHours / Number(task.estimatedHours)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex justify-between">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Délai R→L</span>
                </div>
                <span className={`font-medium ${task.delaiRL !== null && task.delaiRL > 10 ? 'text-red-600' : ''}`}>
                  {task.delaiRL !== null ? `${task.delaiRL} j` : '—'}
                </span>
              </div>

              <div className="flex justify-between">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Rendement</span>
                </div>
                <span className={`font-medium ${
                  task.rendement !== null
                    ? task.rendement >= 90
                      ? 'text-green-600'
                      : task.rendement >= 70
                      ? 'text-yellow-600'
                      : 'text-red-600'
                    : ''
                }`}>
                  {task.rendement !== null ? `${task.rendement}%` : '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {task.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map(({ tag }) => (
                    <Badge
                      key={tag.id}
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        borderColor: tag.color + '40',
                      }}
                      variant="outline"
                      className="text-xs"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <TimeEntryFormDialog
        open={timeEntryOpen}
        onOpenChange={setTimeEntryOpen}
        taskId={id}
      />
      <AddDeliverableDialog
        open={deliverableOpen}
        onOpenChange={setDeliverableOpen}
        taskId={id}
      />
    </div>
  );
}
```

### Step 3: `apps/web/src/app/(app)/tasks/[id]/time-entry-form-dialog.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi } from '@/lib/api/time-entries';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  employeeId: z.string().min(1, 'Requis'),
  date: z.string().min(1, 'Requis'),
  hours: z.coerce.number().positive('Doit être positif').max(24, 'Max 24h'),
  comment: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
}

export function TimeEntryFormDialog({ open, onOpenChange, taskId }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      hours: 1,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      timeEntriesApi.create({ taskId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
      onOpenChange(false);
      form.reset({ date: new Date().toISOString().split('T')[0], hours: 1 });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Saisir du temps</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="employeeId" render={({ field }) => (
              <FormItem>
                <FormLabel>Employé ID *</FormLabel>
                <FormControl>
                  <Input placeholder="UUID de l'employé" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Heures *</FormLabel>
                  <FormControl>
                    <Input type="number" min={0.1} max={24} step={0.25} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="comment" render={({ field }) => (
              <FormItem>
                <FormLabel>Commentaire</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Travaux effectués..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {mutation.error && (
              <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 4: `apps/web/src/app/(app)/tasks/[id]/add-deliverable-dialog.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Link2 } from 'lucide-react';

const schema = z.object({
  url: z.string().url('URL invalide'),
  type: z.enum(['sharepoint', 'onedrive', 'dropbox', 'gdrive', 'url']).optional(),
  label: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
}

export function AddDeliverableDialog({ open, onOpenChange, taskId }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'url' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => tasksApi.addDeliverable(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
      onOpenChange(false);
      form.reset({ type: 'url' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Ajouter un livrable
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="url" render={({ field }) => (
              <FormItem>
                <FormLabel>URL *</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type de lien</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="sharepoint">SharePoint</SelectItem>
                    <SelectItem value="onedrive">OneDrive</SelectItem>
                    <SelectItem value="dropbox">Dropbox</SelectItem>
                    <SelectItem value="gdrive">Google Drive</SelectItem>
                    <SelectItem value="url">URL générique</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="label" render={({ field }) => (
              <FormItem>
                <FormLabel>Libellé</FormLabel>
                <FormControl>
                  <Input placeholder="Plan béton v2, DOE final..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {mutation.error && (
              <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/tasks/\[id\]
git commit -m "feat(web): add /tasks/[id] full detail page with timeline, deliverables, and time entries"
```

---
## Task 12: Final commit

After all tasks are implemented and verified:

```bash
git add -A
git commit -m "feat: Sprint 3A complete — Projects, Tasks, TimeEntries modules with Kanban, Gantt, Délai R→L, Rendement"
```

Then open a PR:

```bash
gh pr create \
  --title "feat: Sprint 3A — Projets & Tâches" \
  --body "## Sprint 3A implementation

### Backend (NestJS)
- **ProjectsModule**: full CRUD, stats, advancement computation, soft delete
- **TasksModule**: full CRUD, Délai R→L calculation (business days, excluding FR public holidays), Rendement formula, status change validation (blocks Terminée/Livrée without deliverable), auto StatusHistory on every status change
- **TimeEntriesModule**: CRUD with 24h daily cap validation, validate endpoint
- All three modules registered in AppModule

### Frontend (Next.js)
- **/projects**: list with StatsBar (4 KPIs), search, status/priority filters, DataTable with advancement progress bar
- **/projects/[id]**: 6-tab detail (Infos edit form · Tâches Kanban/List toggle · Gantt via frappe-gantt · Custom Fields · Commercial placeholder · Historique)
- **/tasks**: global list with StatsBar (4 KPIs including Rendement), search, status/facturable filters, DataTable with Délai R→L and Rendement columns
- **/tasks/[id]**: full 2-column detail — description, custom fields, deliverables panel, interleaved timeline (status history + comments), time entries sub-panel, right sidebar with assignee/project/dates/KPIs

### Business logic
- Délai R→L: counts business days from dateReception to actualEndDate (or today), excluding weekends and public_holidays table (country=FR)
- Rendement: (codeProduit.timeGamme × quantity) / sum(timeEntries.hours) × 100
- Status validation: status change to 'terminee' or 'livree' requires ≥1 TaskDeliverable or deliverableLinks entry
- Auto StatusHistory record created on every status change

**Branch:** feat/projects-tasks
**Prerequisite sprints:** 2A (clients), 2C (custom fields / codes produits), 2D (employees, public holidays)" \
  --base main \
  --head feat/projects-tasks
```

---

## Implementation Notes

### frappe-gantt integration
- The `GanttWrapper` component (`gantt-wrapper.tsx`) is loaded via `dynamic(() => import(...), { ssr: false })` to avoid SSR issues with the DOM-dependent library.
- It creates an SVG element and passes it to `new Gantt(svg, tasks, options)`.
- Tasks without both `plannedStartDate` and `plannedEndDate` are filtered out before rendering.
- View mode is set to `'Week'` by default; you can add a toolbar to switch between `Day`, `Week`, `Month`, `Year`.

### Délai R→L edge cases
- If `dateReception` is null, `delaiRL` is `null`.
- The end date used is `actualEndDate` if set, otherwise `new Date()` (today) — giving a running delay for in-progress tasks.
- The count starts from the day *after* reception (day 0 = reception day).
- Public holidays are fetched per calculation; for performance in list endpoints this runs in `Promise.all` on the paginated result set (max 20–25 records).

### Status validation detail
- The check in `TasksService.update` fires only when `dto.status` differs from the existing status AND the new status is in `['terminee', 'livree']`.
- It checks both `TaskDeliverable` rows (via Prisma count) and `deliverableLinks` string array on the task.
- The error is thrown *before* the transaction begins, so no partial writes occur.

### EntityTag pattern for tasks
- The `EntityTag` model has an `entityId` and `entityType` field (value `'task'`).
- When updating tags, the service deletes all EntityTag rows matching `{ entityId: taskId, entityType: 'task' }` then recreates them inside a transaction.

### Configurable project statuses
- The Kanban board in `project-tasks-tab.tsx` reads `project.customFieldsConfig.statuses` (if present) as the column list.
- Falls back to `['a_traiter', 'en_cours', 'en_revision', 'terminee', 'livree']` when the config is absent or doesn't include a `statuses` key.

### Rendement color coding in the UI
- Green (≥ 90%): task is more efficient than the gamme
- Yellow (70–89%): slightly below target
- Red (< 70%): significantly below target
- These thresholds are applied in both the `/tasks` DataTable and the `/tasks/[id]` sidebar KPI card.

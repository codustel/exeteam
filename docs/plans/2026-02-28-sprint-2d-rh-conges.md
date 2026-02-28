# ExeTeam Sprint 2D — Module RH + Congés Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the full HR module — Employees (org chart, salary history, departments), Leave Requests (business-day calculation, notifications, approval workflow), and Public Holidays (sync from Nager.at API). NestJS API + Next.js UI with employee listing, detail page, and leave management.

**Architecture:** NestJS EmployeesModule + LeavesModule + PublicHolidaysModule. Business-day calculation queries the `public_holidays` table after auto-syncing from Nager.at on demand. Leave approval creates Notification records for the relevant User. The `@CurrentUser()` decorator extracts the authenticated user from the request.

**Tech Stack:** NestJS · Prisma · Zod pipes · TanStack Query · shadcn/ui · react-hook-form + zod · Nager.at public holidays API

**Prerequisite:** Sprint 1 complete, all tables in Supabase, Prisma client generated, RBAC guards and `@CurrentUser()` decorator available. TanStack Query provider in place.

---

## Task 1: Create branch `feat/rh-conges`

```bash
git checkout main && git pull origin main
git checkout -b feat/rh-conges
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/rh-conges branch"
```

---

## Task 2: NestJS EmployeesModule

**Files to create:**
- `apps/api/src/employees/dto/create-employee.dto.ts`
- `apps/api/src/employees/dto/list-employees.dto.ts`
- `apps/api/src/employees/employees.service.ts`
- `apps/api/src/employees/employees.controller.ts`
- `apps/api/src/employees/employees.module.ts`

**Step 1: `apps/api/src/employees/dto/create-employee.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ContractTypeEnum = z.enum([
  'cdi',
  'cdd',
  'stage',
  'freelance',
  'alternance',
]);

export const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().datetime().optional(),
  nationality: z.string().optional(),
  photoUrl: z.string().url().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('FR'),
  personalEmail: z.string().email().optional(),
  professionalEmail: z.string().email().optional(),
  phone: z.string().optional(),
  contractType: ContractTypeEnum.default('cdi'),
  entryDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  trialEndDate: z.string().datetime().optional(),
  position: z.string().optional(),
  weeklyHours: z.number().default(35),
  managerId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

export class CreateEmployeeDto extends createZodDto(CreateEmployeeSchema) {}

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial();
export class UpdateEmployeeDto extends createZodDto(UpdateEmployeeSchema) {}

export const UpdateSalarySchema = z.object({
  grossSalary: z.number().min(0),
  netSalary: z.number().min(0),
  currencyId: z.string().uuid().optional(),
});

export class UpdateSalaryDto extends createZodDto(UpdateSalarySchema) {}
```

**Step 2: `apps/api/src/employees/dto/list-employees.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ContractTypeEnum } from './create-employee.dto';

export const ListEmployeesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  contractType: ContractTypeEnum.optional(),
  managerId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export class ListEmployeesDto extends createZodDto(ListEmployeesSchema) {}
```

**Step 3: `apps/api/src/employees/employees.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateSalaryDto,
} from './dto/create-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListEmployeesDto) {
    const { page, limit, search, departmentId, contractType, managerId, isActive } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where['OR'] = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { professionalEmail: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) where['departmentId'] = departmentId;
    if (contractType) where['contractType'] = contractType;
    if (managerId) where['managerId'] = managerId;
    if (isActive !== undefined) where['isActive'] = isActive;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastName: 'asc' },
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
          user: { select: { id: true, email: true, role: true } },
          _count: {
            select: { assignedTasks: true, leaveRequests: true },
          },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true, position: true } },
        subordinates: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, position: true },
        },
        user: { select: { id: true, email: true, role: true } },
        currency: { select: { id: true, code: true, symbol: true } },
        _count: {
          select: { assignedTasks: true, leaveRequests: true },
        },
      },
    });

    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: dto,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: dto,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
  }

  getOrgChart() {
    return this.prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        photoUrl: true,
        managerId: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async getStats() {
    const today = new Date();

    const [total, active, inactive] = await this.prisma.$transaction([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.employee.count({ where: { isActive: false } }),
    ]);

    const onLeave = await this.prisma.leaveRequest.count({
      where: {
        status: 'approuve',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    const tasksInProgress = await this.prisma.task.count({
      where: { status: 'en_cours' },
    });

    const avgResult = await this.prisma.task.groupBy({
      by: ['employeeId'],
      where: { employeeId: { not: null } },
      _count: { _all: true },
    });

    const avgTasksPerEmployee =
      avgResult.length > 0
        ? avgResult.reduce((sum, r) => sum + r._count._all, 0) / avgResult.length
        : 0;

    return { total, active, inactive, onLeave, tasksInProgress, avgTasksPerEmployee };
  }

  getDepartments() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  createDepartment(name: string) {
    return this.prisma.department.create({ data: { name } });
  }

  async updateSalary(id: string, dto: UpdateSalaryDto) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.salary.create({
        data: {
          employeeId: id,
          grossSalary: dto.grossSalary,
          netSalary: dto.netSalary,
          currencyId: dto.currencyId,
          effectiveDate: new Date(),
        },
      });

      return tx.employee.update({
        where: { id },
        data: {
          grossSalary: dto.grossSalary,
          netSalary: dto.netSalary,
          ...(dto.currencyId && { currencyId: dto.currencyId }),
        },
        select: { id: true, grossSalary: true, netSalary: true },
      });
    });
  }

  async getSalaryHistory(employeeId: string) {
    await this.findOne(employeeId);
    return this.prisma.salary.findMany({
      where: { employeeId },
      orderBy: { effectiveDate: 'desc' },
      include: { currency: { select: { code: true, symbol: true } } },
    });
  }
}
```

**Step 4: `apps/api/src/employees/employees.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateSalaryDto,
} from './dto/create-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('stats')
  @RequirePermissions('employees.read')
  getStats() {
    return this.employeesService.getStats();
  }

  @Get('org-chart')
  @RequirePermissions('employees.read')
  getOrgChart() {
    return this.employeesService.getOrgChart();
  }

  @Get('departments')
  @RequirePermissions('employees.read')
  getDepartments() {
    return this.employeesService.getDepartments();
  }

  @Post('departments')
  @RequirePermissions('employees.create')
  createDepartment(@Body('name') name: string) {
    return this.employeesService.createDepartment(name);
  }

  @Get()
  @RequirePermissions('employees.read')
  findAll(@Query() dto: ListEmployeesDto) {
    return this.employeesService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('employees.read')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @RequirePermissions('employees.create')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('employees.update')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('employees.update')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }

  @Get(':id/salary-history')
  @RequirePermissions('hr.read_salaries')
  getSalaryHistory(@Param('id') id: string) {
    return this.employeesService.getSalaryHistory(id);
  }

  @Patch(':id/salary')
  @RequirePermissions('hr.update_salaries')
  updateSalary(@Param('id') id: string, @Body() dto: UpdateSalaryDto) {
    return this.employeesService.updateSalary(id, dto);
  }
}
```

**Step 5: `apps/api/src/employees/employees.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
```

**Commit:**
```bash
git add apps/api/src/employees
git commit -m "feat(api): add EmployeesModule with CRUD, org-chart, salary history, and stats"
```

---

## Task 3: NestJS LeavesModule

**Files to create:**
- `apps/api/src/leaves/dto/create-leave.dto.ts`
- `apps/api/src/leaves/dto/list-leaves.dto.ts`
- `apps/api/src/leaves/leaves.service.ts`
- `apps/api/src/leaves/leaves.controller.ts`
- `apps/api/src/leaves/leaves.module.ts`

**Step 1: `apps/api/src/leaves/dto/create-leave.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().optional(),
});

export class CreateLeaveDto extends createZodDto(CreateLeaveSchema) {}

export const ApproveLeaveSchema = z.object({
  comment: z.string().optional(),
});

export class ApproveLeaveDto extends createZodDto(ApproveLeaveSchema) {}
```

**Step 2: `apps/api/src/leaves/dto/list-leaves.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListLeavesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().optional(),
  status: z.enum(['en_attente', 'approuve', 'refuse', 'annule']).optional(),
  leaveTypeId: z.string().optional(),
});

export class ListLeavesDto extends createZodDto(ListLeavesSchema) {}
```

**Step 3: `apps/api/src/leaves/leaves.service.ts`**

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto, ApproveLeaveDto } from './dto/create-leave.dto';
import { ListLeavesDto } from './dto/list-leaves.dto';

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate the number of business days between two dates.
   * Excludes weekends (Saturday=6, Sunday=0) and public holidays for the given country/year.
   */
  async calculateBusinessDays(
    start: Date,
    end: Date,
    country = 'FR',
  ): Promise<number> {
    const year = start.getFullYear();

    // Ensure public holidays are synced
    const count = await this.prisma.publicHoliday.count({
      where: { country, date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
    });

    if (count === 0) {
      await this.syncPublicHolidays(year, country);
    }

    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        country,
        date: { gte: start, lte: end },
      },
      select: { date: true },
    });

    const holidaySet = new Set(
      holidays.map((h) => h.date.toISOString().split('T')[0]),
    );

    let days = 0;
    const cursor = new Date(start);

    while (cursor <= end) {
      const dow = cursor.getDay(); // 0=Sun, 6=Sat
      const dateStr = cursor.toISOString().split('T')[0];

      if (dow !== 0 && dow !== 6 && !holidaySet.has(dateStr)) {
        days++;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  private async syncPublicHolidays(year: number, country: string): Promise<void> {
    try {
      const res = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
      );
      if (!res.ok) return;

      const holidays: Array<{ date: string; localName: string; name: string }> =
        await res.json();

      for (const h of holidays) {
        await this.prisma.publicHoliday.upsert({
          where: {
            date_country: { date: new Date(h.date), country },
          },
          update: { name: h.name, localName: h.localName },
          create: {
            date: new Date(h.date),
            country,
            name: h.name,
            localName: h.localName,
          },
        });
      }
    } catch {
      // Non-blocking: skip if API unavailable
    }
  }

  async findAll(dto: ListLeavesDto) {
    const { page, limit, employeeId, status, leaveTypeId } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (employeeId) where['employeeId'] = employeeId;
    if (status) where['status'] = status;
    if (leaveTypeId) where['leaveTypeId'] = leaveTypeId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          leaveType: { select: { id: true, name: true } },
          approver: { select: { id: true, email: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            manager: { select: { id: true, firstName: true, lastName: true, user: { select: { id: true } } } },
          },
        },
        leaveType: true,
        approver: { select: { id: true, email: true } },
      },
    });

    if (!leave) throw new NotFoundException(`Leave request ${id} not found`);
    return leave;
  }

  async create(dto: CreateLeaveDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException('La date de fin doit être après la date de début');
    }

    const days = await this.calculateBusinessDays(start, end);

    if (days === 0) {
      throw new BadRequestException('Aucun jour ouvré dans la période sélectionnée');
    }

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: start,
        endDate: end,
        reason: dto.reason,
        days,
        status: 'en_attente',
      },
      include: {
        employee: {
          include: {
            manager: { select: { id: true, user: { select: { id: true } } } },
          },
        },
        leaveType: { select: { name: true } },
      },
    });

    // Notify manager if they have a user account
    const managerUserId = leaveRequest.employee.manager?.user?.id;
    if (managerUserId) {
      await this.prisma.notification.create({
        data: {
          userId: managerUserId,
          type: 'leave_request',
          title: 'Nouvelle demande de congé',
          message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName} a soumis une demande de ${leaveRequest.leaveType.name} (${days} jour(s))`,
          link: `/leaves/${leaveRequest.id}`,
        },
      });
    }

    return leaveRequest;
  }

  async approve(id: string, approverId: string, dto: ApproveLeaveDto) {
    const leave = await this.findOne(id);

    if (leave.status !== 'en_attente') {
      throw new BadRequestException(`Cette demande est déjà "${leave.status}"`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'approuve', approverId, approvedAt: new Date(), approverComment: dto.comment },
      include: {
        employee: { include: { user: { select: { id: true } } } },
        leaveType: { select: { name: true } },
      },
    });

    // Notify employee
    const employeeUserId = updated.employee.user?.id;
    if (employeeUserId) {
      await this.prisma.notification.create({
        data: {
          userId: employeeUserId,
          type: 'leave_approved',
          title: 'Demande de congé approuvée',
          message: `Votre demande de ${updated.leaveType.name} a été approuvée`,
          link: `/leaves/${id}`,
        },
      });
    }

    return updated;
  }

  async refuse(id: string, approverId: string, dto: ApproveLeaveDto) {
    const leave = await this.findOne(id);

    if (leave.status !== 'en_attente') {
      throw new BadRequestException(`Cette demande est déjà "${leave.status}"`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'refuse', approverId, approvedAt: new Date(), approverComment: dto.comment },
      include: {
        employee: { include: { user: { select: { id: true } } } },
        leaveType: { select: { name: true } },
      },
    });

    // Notify employee
    const employeeUserId = updated.employee.user?.id;
    if (employeeUserId) {
      await this.prisma.notification.create({
        data: {
          userId: employeeUserId,
          type: 'leave_refused',
          title: 'Demande de congé refusée',
          message: `Votre demande de ${updated.leaveType.name} a été refusée${dto.comment ? ` : ${dto.comment}` : ''}`,
          link: `/leaves/${id}`,
        },
      });
    }

    return updated;
  }

  async cancel(id: string, requestingEmployeeId: string) {
    const leave = await this.findOne(id);

    if (leave.employeeId !== requestingEmployeeId) {
      throw new ForbiddenException('Vous ne pouvez annuler que vos propres demandes');
    }

    if (leave.status !== 'en_attente') {
      throw new BadRequestException('Seules les demandes en attente peuvent être annulées');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'annule' },
    });
  }

  getLeaveTypes() {
    return this.prisma.leaveType.findMany({ orderBy: { name: 'asc' } });
  }

  createLeaveType(data: { name: string; daysPerYear?: number; isCarryOver?: boolean }) {
    return this.prisma.leaveType.create({ data });
  }
}
```

**Step 4: `apps/api/src/leaves/leaves.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto, ApproveLeaveDto } from './dto/create-leave.dto';
import { ListLeavesDto } from './dto/list-leaves.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get('types')
  @RequirePermissions('leaves.read')
  getLeaveTypes() {
    return this.leavesService.getLeaveTypes();
  }

  @Post('types')
  @RequirePermissions('leaves.approve')
  createLeaveType(
    @Body() body: { name: string; daysPerYear?: number; isCarryOver?: boolean },
  ) {
    return this.leavesService.createLeaveType(body);
  }

  @Get()
  @RequirePermissions('leaves.read')
  findAll(@Query() dto: ListLeavesDto) {
    return this.leavesService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('leaves.read')
  findOne(@Param('id') id: string) {
    return this.leavesService.findOne(id);
  }

  @Post()
  @RequirePermissions('leaves.create')
  create(@Body() dto: CreateLeaveDto) {
    return this.leavesService.create(dto);
  }

  @Patch(':id/approve')
  @RequirePermissions('leaves.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.leavesService.approve(id, user.id, dto);
  }

  @Patch(':id/refuse')
  @RequirePermissions('leaves.approve')
  refuse(
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.leavesService.refuse(id, user.id, dto);
  }

  @Patch(':id/cancel')
  @RequirePermissions('leaves.create')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; employeeId?: string },
  ) {
    if (!user.employeeId) {
      throw new Error('Aucun employé associé à votre compte');
    }
    return this.leavesService.cancel(id, user.employeeId);
  }
}
```

**Step 5: `apps/api/src/leaves/leaves.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
```

**Commit:**
```bash
git add apps/api/src/leaves
git commit -m "feat(api): add LeavesModule with business-day calculation, approval flow, and notifications"
```

---

## Task 4: NestJS PublicHolidaysModule

**Files to create:**
- `apps/api/src/public-holidays/public-holidays.service.ts`
- `apps/api/src/public-holidays/public-holidays.controller.ts`
- `apps/api/src/public-holidays/public-holidays.module.ts`

**Step 1: `apps/api/src/public-holidays/public-holidays.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
}

@Injectable()
export class PublicHolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(year: number, country = 'FR') {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year}-12-31`);

    return this.prisma.publicHoliday.findMany({
      where: { country, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
  }

  async syncFromNager(year: number, country = 'FR'): Promise<{ synced: number }> {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
    );

    if (!res.ok) {
      throw new Error(
        `Nager.at API error: ${res.status} ${res.statusText}`,
      );
    }

    const holidays: NagerHoliday[] = await res.json();
    let synced = 0;

    for (const h of holidays) {
      await this.prisma.publicHoliday.upsert({
        where: { date_country: { date: new Date(h.date), country } },
        update: { name: h.name, localName: h.localName },
        create: {
          date: new Date(h.date),
          country,
          name: h.name,
          localName: h.localName,
        },
      });
      synced++;
    }

    return { synced };
  }

  async ensureSync(year: number, country = 'FR'): Promise<void> {
    const count = await this.prisma.publicHoliday.count({
      where: {
        country,
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
    });

    if (count === 0) {
      await this.syncFromNager(year, country);
    }
  }
}
```

**Step 2: `apps/api/src/public-holidays/public-holidays.controller.ts`**

```typescript
import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PublicHolidaysService } from './public-holidays.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('public-holidays')
export class PublicHolidaysController {
  constructor(private readonly publicHolidaysService: PublicHolidaysService) {}

  @Get()
  @RequirePermissions('leaves.read')
  findAll(
    @Query('year') year: string,
    @Query('country') country = 'FR',
  ) {
    return this.publicHolidaysService.findAll(
      parseInt(year, 10) || new Date().getFullYear(),
      country,
    );
  }

  @Post('sync/:year')
  @RequirePermissions('admin.settings')
  sync(
    @Param('year') year: string,
    @Query('country') country = 'FR',
  ) {
    return this.publicHolidaysService.syncFromNager(
      parseInt(year, 10),
      country,
    );
  }
}
```

**Step 3: `apps/api/src/public-holidays/public-holidays.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PublicHolidaysService } from './public-holidays.service';
import { PublicHolidaysController } from './public-holidays.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PublicHolidaysController],
  providers: [PublicHolidaysService],
  exports: [PublicHolidaysService],
})
export class PublicHolidaysModule {}
```

**Commit:**
```bash
git add apps/api/src/public-holidays
git commit -m "feat(api): add PublicHolidaysModule with Nager.at sync"
```

---

## Task 5: Register all modules in AppModule

**File to modify:** `apps/api/src/app.module.ts`

```typescript
// Add imports:
import { EmployeesModule } from './employees/employees.module';
import { LeavesModule } from './leaves/leaves.module';
import { PublicHolidaysModule } from './public-holidays/public-holidays.module';

// Add to @Module({ imports: [...] }):
// EmployeesModule,
// LeavesModule,
// PublicHolidaysModule,
```

**Commit:**
```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register Employees, Leaves, PublicHolidays modules"
```

---

## Task 6: Seed leave types

**File to modify:** `packages/db/prisma/seed.ts`

Add the following block after the existing seeding logic (currencies, roles, permissions, etc.):

```typescript
// ─── Leave Types ────────────────────────────────────────────────────────────
console.log('Seeding leave types...');

const leaveTypes = [
  { name: 'Congés payés', daysPerYear: 25, isCarryOver: true },
  { name: 'RTT', daysPerYear: 10, isCarryOver: false },
  { name: 'Maladie', daysPerYear: null, isCarryOver: false },
  { name: 'Exceptionnel familial', daysPerYear: null, isCarryOver: false },
  { name: 'Formation', daysPerYear: null, isCarryOver: false },
];

for (const lt of leaveTypes) {
  await prisma.leaveType.upsert({
    where: { name: lt.name },
    update: {},
    create: lt,
  });
}

console.log(`Seeded ${leaveTypes.length} leave types`);
```

Note: If `LeaveType` does not yet have `@@unique([name])` in the Prisma schema, add it:

```prisma
model LeaveType {
  id          String   @id @default(cuid())
  name        String   @unique   // <-- add @unique
  daysPerYear Int?
  isCarryOver Boolean  @default(false)
  // ...
}
```

Then run:

```bash
cd packages/db && pnpm prisma migrate dev --name add-leave-type-unique-name
pnpm prisma db seed
```

**Commit:**
```bash
git add packages/db/prisma/seed.ts packages/db/prisma/schema.prisma
git commit -m "feat(db): seed leave types (congés payés, RTT, maladie, etc.)"
```

---

## Task 7: Next.js /employees page

**Files to create:**
- `apps/web/src/lib/api/employees.ts`
- `apps/web/src/app/(app)/employees/employee-form-dialog.tsx`
- `apps/web/src/app/(app)/employees/employees-table.tsx`
- `apps/web/src/app/(app)/employees/page.tsx`

**Step 1: `apps/web/src/lib/api/employees.ts`**

```typescript
import { apiRequest } from './client';

export interface Department {
  id: string;
  name: string;
  _count?: { employees: number };
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  professionalEmail?: string;
  personalEmail?: string;
  phone?: string;
  position?: string;
  photoUrl?: string;
  contractType: string;
  entryDate?: string;
  endDate?: string;
  trialEndDate?: string;
  weeklyHours: number;
  isActive: boolean;
  departmentId?: string;
  department?: Department;
  managerId?: string;
  manager?: { id: string; firstName: string; lastName: string };
  user?: { id: string; email: string; role: string };
  grossSalary?: number;
  netSalary?: number;
  _count: { assignedTasks: number; leaveRequests: number };
}

export interface EmployeesStats {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  tasksInProgress: number;
  avgTasksPerEmployee: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListEmployeesParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  contractType?: string;
  managerId?: string;
  isActive?: boolean;
}

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') q.set(key, String(value));
  }
  return q.toString() ? `?${q.toString()}` : '';
}

export const employeesApi = {
  list: (params: ListEmployeesParams = {}) =>
    apiRequest<PaginatedResponse<Employee>>(`/employees${toQuery(params)}`),

  getOne: (id: string) => apiRequest<Employee>(`/employees/${id}`),

  getStats: () => apiRequest<EmployeesStats>('/employees/stats'),

  getDepartments: () => apiRequest<Department[]>('/employees/departments'),

  create: (body: Record<string, unknown>) =>
    apiRequest<Employee>('/employees', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    apiRequest<Employee>(`/employees/${id}`, { method: 'DELETE' }),

  updateSalary: (id: string, body: { grossSalary: number; netSalary: number; currencyId?: string }) =>
    apiRequest(`/employees/${id}/salary`, { method: 'PATCH', body: JSON.stringify(body) }),

  getSalaryHistory: (id: string) =>
    apiRequest(`/employees/${id}/salary-history`),
};
```

**Step 2: `apps/web/src/app/(app)/employees/employee-form-dialog.tsx`**

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { employeesApi, Employee } from '@/lib/api/employees';

const contractTypes = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'stage', label: 'Stage' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'alternance', label: 'Alternance' },
];

const formSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  professionalEmail: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().optional(),
  contractType: z.enum(['cdi', 'cdd', 'stage', 'freelance', 'alternance']),
  entryDate: z.string().optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: EmployeeFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!employee;

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeesApi.getDepartments(),
  });

  const { data: managers } = useQuery({
    queryKey: ['employees', { limit: 100, isActive: true }],
    queryFn: () => employeesApi.list({ limit: 100, isActive: true }),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      professionalEmail: employee?.professionalEmail ?? '',
      phone: employee?.phone ?? '',
      position: employee?.position ?? '',
      contractType: (employee?.contractType as FormValues['contractType']) ?? 'cdi',
      entryDate: employee?.entryDate?.split('T')[0] ?? '',
      departmentId: employee?.departmentId ?? '',
      managerId: employee?.managerId ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body: Record<string, unknown> = { ...values };
      if (values.entryDate) body.entryDate = new Date(values.entryDate).toISOString();
      if (!body.departmentId) delete body.departmentId;
      if (!body.managerId) delete body.managerId;
      return isEdit
        ? employeesApi.update(employee!.id, body)
        : employeesApi.create(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-stats'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le collaborateur' : 'Nouveau collaborateur'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prénom *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="professionalEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email professionnel</FormLabel>
                  <FormControl><Input {...field} type="email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="position" render={({ field }) => (
              <FormItem>
                <FormLabel>Poste / Fonction</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="contractType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de contrat</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contractTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="entryDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date d'entrée</FormLabel>
                  <FormControl><Input {...field} type="date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Département</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="managerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsable</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {managers?.data
                        .filter((e) => !isEdit || e.id !== employee?.id)
                        .map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.firstName} {e.lastName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: `apps/web/src/app/(app)/employees/employees-table.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { MoreHorizontal, Plus } from 'lucide-react';
import { employeesApi, Employee, ListEmployeesParams } from '@/lib/api/employees';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmployeeFormDialog } from './employee-form-dialog';

const contractLabels: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', stage: 'Stage', freelance: 'Freelance', alternance: 'Alternance',
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

function StatsBar({ stats }: {
  stats: { active: number; avgTasksPerEmployee: number; onLeave: number; inactive: number }
}) {
  const items = [
    { label: 'Effectif actif', value: stats.active },
    { label: 'Tâches / personne', value: stats.avgTasksPerEmployee.toFixed(1) },
    { label: 'En congé', value: stats.onLeave },
    { label: 'Inactifs', value: stats.inactive },
  ];
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {items.map((item) => (
        <div key={item.label} className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <p className="text-2xl font-bold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function EmployeesTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | undefined>();
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const params: ListEmployeesParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  };

  const { data: stats } = useQuery({
    queryKey: ['employees-stats'],
    queryFn: () => employeesApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['employees', params],
    queryFn: () => employeesApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-stats'] });
    },
  });

  return (
    <div>
      {stats && <StatsBar stats={stats} />}

      <div className="flex items-center justify-between mb-4">
        <Input
          placeholder="Nom, email, poste..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <Button onClick={() => { setEditEmployee(undefined); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau collaborateur
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Collaborateur</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Contrat</TableHead>
              <TableHead>Tâches</TableHead>
              <TableHead>Compte</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                    )}
                    <div>
                      <Link href={`/employees/${emp.id}`} className="font-medium hover:underline">
                        {emp.firstName} {emp.lastName}
                      </Link>
                      {emp.professionalEmail && (
                        <p className="text-xs text-muted-foreground">{emp.professionalEmail}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{emp.position ?? '—'}</TableCell>
                <TableCell>{emp.department?.name ?? '—'}</TableCell>
                <TableCell>
                  {emp.manager ? (
                    <Link href={`/employees/${emp.manager.id}`} className="hover:underline text-sm">
                      {emp.manager.firstName} {emp.manager.lastName}
                    </Link>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{contractLabels[emp.contractType] ?? emp.contractType}</Badge>
                </TableCell>
                <TableCell>{emp._count.assignedTasks}</TableCell>
                <TableCell>
                  {emp.user ? (
                    <Badge variant="default" className="bg-green-500 text-xs">{emp.user.role}</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Aucun</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={emp.isActive ? 'default' : 'secondary'}>
                    {emp.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/employees/${emp.id}`}>Voir le profil</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditEmployee(emp); setDialogOpen(true); }}>
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(emp.id)}
                      >
                        Désactiver
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {data.meta.total} résultats — Page {data.meta.page} / {data.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <EmployeeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} employee={editEmployee} />
    </div>
  );
}
```

**Step 4: `apps/web/src/app/(app)/employees/page.tsx`**

```typescript
import { EmployeesTable } from './employees-table';

export const metadata = { title: 'Collaborateurs — ExeTeam' };

export default function EmployeesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Collaborateurs</h1>
        <p className="text-muted-foreground">Gestion des ressources humaines</p>
      </div>
      <EmployeesTable />
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/lib/api/employees.ts "apps/web/src/app/(app)/employees"
git commit -m "feat(web): add /employees page with stats bar, table, and create/edit dialog"
```

---

## Task 8: Next.js /employees/[id] detail page

**Files to create:**
- `apps/web/src/app/(app)/employees/[id]/employee-detail.tsx`
- `apps/web/src/app/(app)/employees/[id]/page.tsx`

**Step 1: `apps/web/src/app/(app)/employees/[id]/employee-detail.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { employeesApi } from '@/lib/api/employees';
import { apiRequest } from '@/lib/api/client';

const contractLabels: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', stage: 'Stage', freelance: 'Freelance', alternance: 'Alternance',
};

const statusLabels: Record<string, string> = {
  en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé', annule: 'Annulé',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  en_attente: 'outline', approuve: 'default', refuse: 'destructive', annule: 'secondary',
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

export function EmployeeDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getOne(id),
  });

  const approveMutation = useMutation({
    mutationFn: (leaveId: string) =>
      apiRequest(`/leaves/${leaveId}/approve`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee', id] }),
  });

  const refuseMutation = useMutation({
    mutationFn: (leaveId: string) =>
      apiRequest(`/leaves/${leaveId}/refuse`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee', id] }),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Chargement...</div>;
  if (!employee) return <div className="p-6">Collaborateur introuvable</div>;

  const leaveRequests = (employee as any).leaveRequests?.slice(0, 10) ?? [];

  return (
    <div className="p-6">
      <div className="flex items-start gap-4 mb-6">
        {employee.photoUrl ? (
          <img src={employee.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
            {getInitials(employee.firstName, employee.lastName)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{employee.firstName} {employee.lastName}</h1>
          {employee.position && <p className="text-muted-foreground">{employee.position}</p>}
          <div className="flex gap-2 mt-2">
            <Badge variant={employee.isActive ? 'default' : 'secondary'}>
              {employee.isActive ? 'Actif' : 'Inactif'}
            </Badge>
            <Badge variant="outline">{contractLabels[employee.contractType] ?? employee.contractType}</Badge>
            {employee.department && (
              <Badge variant="outline">{employee.department.name}</Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="infos">
        <TabsList className="mb-6">
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="contrat">Contrat</TabsTrigger>
          <TabsTrigger value="conges">Congés</TabsTrigger>
          <TabsTrigger value="equipe">Équipe</TabsTrigger>
          <TabsTrigger value="activite">Activité</TabsTrigger>
          <TabsTrigger value="salaire">Salaire</TabsTrigger>
        </TabsList>

        <TabsContent value="infos">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Contact</h3>
              {employee.professionalEmail && (
                <p className="text-sm">{employee.professionalEmail}</p>
              )}
              {employee.phone && <p className="text-sm">{employee.phone}</p>}
              {(employee as any).addressLine1 && (
                <p className="text-sm">{(employee as any).addressLine1}</p>
              )}
            </div>
            <div className="bg-card border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Informations personnelles</h3>
              {(employee as any).dateOfBirth && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Naissance : </span>
                  {formatDate((employee as any).dateOfBirth)}
                </div>
              )}
              {(employee as any).nationality && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Nationalité : </span>
                  {(employee as any).nationality}
                </div>
              )}
              {employee.user && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Compte : </span>
                  <Badge variant="default" className="text-xs">{employee.user.role}</Badge>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contrat">
          <div className="bg-card border rounded-lg p-4 space-y-3 max-w-md">
            <h3 className="font-semibold">Détails du contrat</h3>
            {[
              { label: 'Type', value: contractLabels[employee.contractType] ?? employee.contractType },
              { label: 'Entrée', value: formatDate(employee.entryDate) },
              { label: 'Fin de contrat', value: formatDate(employee.endDate) },
              { label: "Fin d'essai", value: formatDate(employee.trialEndDate) },
              { label: 'Heures / semaine', value: `${employee.weeklyHours}h` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="conges">
          <div className="space-y-3">
            {leaveRequests.length === 0 && (
              <p className="text-muted-foreground text-center py-8">Aucune demande de congé</p>
            )}
            {leaveRequests.map((leave: any) => (
              <div key={leave.id} className="border rounded-lg p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{leave.leaveType?.name ?? 'Congé'}</span>
                    <Badge variant={statusVariants[leave.status] ?? 'outline'}>
                      {statusLabels[leave.status] ?? leave.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                    {leave.days != null && ` (${leave.days} jour(s))`}
                  </p>
                  {leave.reason && <p className="text-sm mt-1">{leave.reason}</p>}
                </div>
                {leave.status === 'en_attente' && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-green-600"
                      onClick={() => approveMutation.mutate(leave.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => refuseMutation.mutate(leave.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="equipe">
          <div className="space-y-4">
            {employee.manager && (
              <div>
                <h3 className="font-semibold mb-2">Responsable</h3>
                <Link
                  href={`/employees/${employee.manager.id}`}
                  className="inline-flex items-center gap-2 border rounded-lg p-3 hover:bg-muted"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {getInitials(employee.manager.firstName, employee.manager.lastName)}
                  </div>
                  <div>
                    <p className="font-medium">{employee.manager.firstName} {employee.manager.lastName}</p>
                    {(employee.manager as any).position && (
                      <p className="text-xs text-muted-foreground">{(employee.manager as any).position}</p>
                    )}
                  </div>
                </Link>
              </div>
            )}

            {(employee as any).subordinates?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">
                  Équipe ({(employee as any).subordinates.length})
                </h3>
                <div className="space-y-2">
                  {(employee as any).subordinates.map((sub: any) => (
                    <Link
                      key={sub.id}
                      href={`/employees/${sub.id}`}
                      className="flex items-center gap-2 border rounded-lg p-3 hover:bg-muted"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {getInitials(sub.firstName, sub.lastName)}
                      </div>
                      <div>
                        <p className="font-medium">{sub.firstName} {sub.lastName}</p>
                        {sub.position && (
                          <p className="text-xs text-muted-foreground">{sub.position}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {!employee.manager && !(employee as any).subordinates?.length && (
              <p className="text-muted-foreground text-center py-8">Aucune information d'équipe</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activite">
          <div className="text-muted-foreground py-8 text-center">
            Activité disponible en Sprint 3
          </div>
        </TabsContent>

        <TabsContent value="salaire">
          <div className="text-muted-foreground py-8 text-center">
            Historique salaire disponible (accès restreint RH)
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: `apps/web/src/app/(app)/employees/[id]/page.tsx`**

```typescript
import { EmployeeDetail } from './employee-detail';

interface Props {
  params: { id: string };
}

export const metadata = { title: 'Profil collaborateur — ExeTeam' };

export default function EmployeeDetailPage({ params }: Props) {
  return <EmployeeDetail id={params.id} />;
}
```

**Commit:**
```bash
git add "apps/web/src/app/(app)/employees/[id]"
git commit -m "feat(web): add /employees/[id] detail page with tabs (infos, contrat, congés, équipe)"
```

---

## Task 9: Next.js /leaves page

**Files to create:**
- `apps/web/src/lib/api/leaves.ts`
- `apps/web/src/app/(app)/leaves/leave-form-dialog.tsx`
- `apps/web/src/app/(app)/leaves/leaves-list.tsx`
- `apps/web/src/app/(app)/leaves/page.tsx`

**Step 1: `apps/web/src/lib/api/leaves.ts`**

```typescript
import { apiRequest } from './client';

export interface LeaveType {
  id: string;
  name: string;
  daysPerYear?: number;
  isCarryOver: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string };
  leaveTypeId: string;
  leaveType?: { id: string; name: string };
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'en_attente' | 'approuve' | 'refuse' | 'annule';
  approver?: { id: string; email: string };
  approverComment?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListLeavesParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  status?: string;
  leaveTypeId?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') q.set(key, String(value));
  }
  return q.toString() ? `?${q.toString()}` : '';
}

export const leavesApi = {
  list: (params: ListLeavesParams = {}) =>
    apiRequest<PaginatedResponse<LeaveRequest>>(`/leaves${toQuery(params)}`),

  getOne: (id: string) => apiRequest<LeaveRequest>(`/leaves/${id}`),

  getTypes: () => apiRequest<LeaveType[]>('/leaves/types'),

  create: (body: Record<string, unknown>) =>
    apiRequest<LeaveRequest>('/leaves', { method: 'POST', body: JSON.stringify(body) }),

  approve: (id: string, comment?: string) =>
    apiRequest(`/leaves/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ comment }) }),

  refuse: (id: string, comment?: string) =>
    apiRequest(`/leaves/${id}/refuse`, { method: 'PATCH', body: JSON.stringify({ comment }) }),

  cancel: (id: string) =>
    apiRequest(`/leaves/${id}/cancel`, { method: 'PATCH' }),
};
```

**Step 2: `apps/web/src/app/(app)/leaves/leave-form-dialog.tsx`**

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { leavesApi } from '@/lib/api/leaves';
import { employeesApi } from '@/lib/api/employees';

const formSchema = z.object({
  employeeId: z.string().uuid('Collaborateur requis'),
  leaveTypeId: z.string().uuid('Type de congé requis'),
  startDate: z.string().min(1, 'Date de début requise'),
  endDate: z.string().min(1, 'Date de fin requise'),
  reason: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LeaveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmployeeId?: string;
}

export function LeaveFormDialog({
  open,
  onOpenChange,
  defaultEmployeeId,
}: LeaveFormDialogProps) {
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ['employees', { limit: 100, isActive: true }],
    queryFn: () => employeesApi.list({ limit: 100, isActive: true }),
  });

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => leavesApi.getTypes(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: defaultEmployeeId ?? '',
      leaveTypeId: '',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      leavesApi.create({
        ...values,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle demande de congé</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="employeeId" render={({ field }) => (
              <FormItem>
                <FormLabel>Collaborateur *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees?.data.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="leaveTypeId" render={({ field }) => (
              <FormItem>
                <FormLabel>Type de congé *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {leaveTypes?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de début *</FormLabel>
                  <FormControl><Input {...field} type="date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de fin *</FormLabel>
                  <FormControl><Input {...field} type="date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Motif</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} placeholder="Motif optionnel..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Enregistrement...' : 'Soumettre'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: `apps/web/src/app/(app)/leaves/leaves-list.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Plus } from 'lucide-react';
import { leavesApi, LeaveRequest, ListLeavesParams } from '@/lib/api/leaves';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeaveFormDialog } from './leave-form-dialog';

const statusLabels: Record<string, string> = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
  annule: 'Annulé',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  en_attente: 'outline',
  approuve: 'default',
  refuse: 'destructive',
  annule: 'secondary',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

export function LeavesList() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const params: ListLeavesParams = {
    page,
    limit: 20,
    status: status || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', params],
    queryFn: () => leavesApi.list(params),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => leavesApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
  });

  const refuseMutation = useMutation({
    mutationFn: (id: string) => leavesApi.refuse(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tous statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="approuve">Approuvé</SelectItem>
            <SelectItem value="refuse">Refusé</SelectItem>
            <SelectItem value="annule">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle demande
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-center py-8">Chargement...</p>}

      <div className="space-y-3">
        {data?.data.map((leave) => (
          <LeaveCard
            key={leave.id}
            leave={leave}
            onApprove={() => approveMutation.mutate(leave.id)}
            onRefuse={() => refuseMutation.mutate(leave.id)}
          />
        ))}
        {data?.data.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Aucune demande de congé</p>
        )}
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            {data.meta.total} demandes — Page {data.meta.page} / {data.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <LeaveFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function LeaveCard({
  leave,
  onApprove,
  onRefuse,
}: {
  leave: LeaveRequest;
  onApprove: () => void;
  onRefuse: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 flex items-start justify-between bg-card">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {leave.employee && (
            <span className="font-medium">
              {leave.employee.firstName} {leave.employee.lastName}
            </span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-sm">{leave.leaveType?.name ?? 'Congé'}</span>
          <Badge variant={statusVariants[leave.status] ?? 'outline'}>
            {statusLabels[leave.status] ?? leave.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
          {' '}({leave.days} jour(s))
        </p>
        {leave.reason && <p className="text-sm">{leave.reason}</p>}
        {leave.approverComment && (
          <p className="text-sm text-muted-foreground italic">
            Commentaire : {leave.approverComment}
          </p>
        )}
      </div>

      {leave.status === 'en_attente' && (
        <div className="flex gap-1 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="text-green-600 border-green-600 hover:bg-green-50"
            onClick={onApprove}
            title="Approuver"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="text-destructive border-destructive hover:bg-red-50"
            onClick={onRefuse}
            title="Refuser"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 4: `apps/web/src/app/(app)/leaves/page.tsx`**

```typescript
import { LeavesList } from './leaves-list';

export const metadata = { title: 'Congés — ExeTeam' };

export default function LeavesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Congés</h1>
        <p className="text-muted-foreground">Gestion des demandes de congé</p>
      </div>
      <LeavesList />
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/lib/api/leaves.ts "apps/web/src/app/(app)/leaves"
git commit -m "feat(web): add /leaves page with card list, status filter, approve/refuse actions"
```

---

## Task 10: Verification + push

```bash
# Build check
pnpm build

# Seed the database
cd packages/db && pnpm prisma db seed

# Run API and test:
# POST /public-holidays/sync/2025?country=FR
#   → { synced: 11 }

# POST /employees { "firstName":"Alice","lastName":"Dupont","contractType":"cdi" }
# GET  /employees/stats
#   → { total:1, active:1, inactive:0, onLeave:0, ... }

# GET  /leaves/types
#   → [{ name:"Congés payés", daysPerYear:25 }, ...]

# POST /leaves { "employeeId":"<uuid>","leaveTypeId":"<uuid>","startDate":"2025-07-14T00:00:00Z","endDate":"2025-07-18T00:00:00Z" }
#   Note: 2025-07-14 is Bastille Day (public holiday) → should not count
#   Expected days: 4 (Mon+Tue+Thu+Fri, Wed 16 excluded as holiday for 2025)

# PATCH /leaves/<uuid>/approve
#   → status: "approuve", notification created for employee user

# Push branch
git push -u origin feat/rh-conges
```

**Commit:**
```bash
git add -A && git commit -m "chore(sprint-2d): final verification — HR, leaves, public holidays complete"
```

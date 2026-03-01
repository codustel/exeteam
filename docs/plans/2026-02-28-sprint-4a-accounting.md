# ExeTeam Sprint 4A — Comptabilité Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the accounting module — NestJS API (`AccountingModule`) + Next.js UI — covering Suppliers CRUD, Purchase Invoices CRUD with file upload, Expense Reports with N+1 approval workflow, and VAT management (multiple rates). All pages under `/accounting/*` with StatsBar, DataTable, search, filters, and TanStack Query.

**Architecture:** NestJS `AccountingModule` groups three controllers (`SuppliersController`, `PurchaseInvoicesController`, `ExpenseReportsController`) with corresponding services. Purchase invoice files are uploaded to Supabase Storage. Expense reports follow an approval workflow: employee creates → N+1 manager reviews → approve/refuse → notification. Shared TypeScript types and enums live in `packages/shared/src/accounting.ts`.

**Tech Stack:** NestJS · Prisma · Zod pipes · Supabase Storage · TanStack Query · shadcn/ui · react-hook-form + zod · Lucide React

**Branch:** `feat/accounting`

**Prerequisite:** Sprint 2D (employees/leaves), Sprint 3C (commercial/invoices) complete.

---

## Task 1: Create branch `feat/accounting`

```bash
git checkout main && git pull origin main
git checkout -b feat/accounting
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/accounting branch"
```

---

## Task 2: Shared accounting types and enums (`packages/shared`)

### Step 1: Add accounting enums to `packages/shared/src/enums.ts`

Append the following to the bottom of the enums file:

```typescript
export const PURCHASE_INVOICE_STATUS = {
  EN_ATTENTE: 'en_attente',
  VALIDEE: 'validee',
  PAYEE_PARTIELLEMENT: 'payee_partiellement',
  PAYEE: 'payee',
  ANNULEE: 'annulee',
} as const;

export type PurchaseInvoiceStatus = (typeof PURCHASE_INVOICE_STATUS)[keyof typeof PURCHASE_INVOICE_STATUS];

export const PURCHASE_INVOICE_STATUS_LABELS: Record<PurchaseInvoiceStatus, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  payee_partiellement: 'Payée partiellement',
  payee: 'Payée',
  annulee: 'Annulée',
};

export const PURCHASE_INVOICE_STATUS_COLORS: Record<PurchaseInvoiceStatus, string> = {
  en_attente: '#F59E0B',
  validee: '#3B82F6',
  payee_partiellement: '#8B5CF6',
  payee: '#22C55E',
  annulee: '#6B7280',
};

export const EXPENSE_REPORT_STATUS = {
  EN_ATTENTE: 'en_attente',
  APPROUVE: 'approuve',
  REFUSE: 'refuse',
  REMBOURSE: 'rembourse',
} as const;

export type ExpenseReportStatus = (typeof EXPENSE_REPORT_STATUS)[keyof typeof EXPENSE_REPORT_STATUS];

export const EXPENSE_REPORT_STATUS_LABELS: Record<ExpenseReportStatus, string> = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
  rembourse: 'Remboursé',
};

export const EXPENSE_REPORT_STATUS_COLORS: Record<ExpenseReportStatus, string> = {
  en_attente: '#F59E0B',
  approuve: '#22C55E',
  refuse: '#EF4444',
  rembourse: '#3B82F6',
};
```

### Step 2: Create `packages/shared/src/accounting.ts`

```typescript
// packages/shared/src/accounting.ts

export interface SupplierSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vatNumber: string | null;
  siret: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { purchaseInvoices: number };
}

export interface PurchaseInvoiceSummary {
  id: string;
  reference: string;
  supplierId: string;
  supplier: { id: string; name: string };
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  totalHt: number;
  vatAmount: number;
  totalTtc: number;
  amountPaid: number;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseReportSummary {
  id: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string };
  approverId: string | null;
  approver: { id: string; firstName: string; lastName: string } | null;
  title: string;
  description: string | null;
  amount: number;
  vatAmount: number | null;
  status: string;
  expenseDate: string;
  receiptUrl: string | null;
  currency: { code: string; symbol: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Standard VAT rates for France */
export const VAT_RATES = [
  { label: 'TVA 20%', value: 20 },
  { label: 'TVA 10%', value: 10 },
  { label: 'TVA 5.5%', value: 5.5 },
  { label: 'TVA 2.1%', value: 2.1 },
  { label: 'Exonéré', value: 0 },
] as const;
```

### Step 3: Export from `packages/shared/src/index.ts`

Add to the barrel export:

```typescript
export * from './accounting';
```

**Commit:**
```bash
git add packages/shared/src/enums.ts packages/shared/src/accounting.ts packages/shared/src/index.ts
git commit -m "feat(shared): add accounting types, enums, and VAT rates"
```

---

## Task 3: NestJS — SuppliersController + Service

The `Supplier` model already exists in Prisma. Build full CRUD.

**Files to create:**
- `apps/api/src/accounting/dto/create-supplier.dto.ts`
- `apps/api/src/accounting/dto/list-suppliers.dto.ts`
- `apps/api/src/accounting/suppliers.service.ts`
- `apps/api/src/accounting/suppliers.controller.ts`

### Step 1: `apps/api/src/accounting/dto/create-supplier.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  vatNumber: z.string().max(30).optional().or(z.literal('')),
  siret: z.string().max(20).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export class CreateSupplierDto extends createZodDto(CreateSupplierSchema) {}
export class UpdateSupplierDto extends createZodDto(CreateSupplierSchema.partial()) {}
```

### Step 2: `apps/api/src/accounting/dto/list-suppliers.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListSuppliersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export class ListSuppliersDto extends createZodDto(ListSuppliersSchema) {}
```

### Step 3: `apps/api/src/accounting/suppliers.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersDto } from './dto/list-suppliers.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListSuppliersDto) {
    const { page, limit, search, isActive } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { siret: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where, skip, take: limit,
        include: { _count: { select: { purchaseInvoices: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { purchaseInvoices: true } },
        purchaseInvoices: {
          take: 10,
          orderBy: { invoiceDate: 'desc' },
          select: { id: true, reference: true, status: true, totalTtc: true, invoiceDate: true },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft-deactivate: set isActive = false
    return this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
  }

  async getStats() {
    const [total, active] = await Promise.all([
      this.prisma.supplier.count(),
      this.prisma.supplier.count({ where: { isActive: true } }),
    ]);
    const totalPurchaseHt = await this.prisma.purchaseInvoice.aggregate({
      _sum: { totalHt: true },
    });
    return {
      total,
      active,
      inactive: total - active,
      totalPurchaseHt: Number(totalPurchaseHt._sum.totalHt ?? 0),
    };
  }
}
```

### Step 4: `apps/api/src/accounting/suppliers.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersDto } from './dto/list-suppliers.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private service: SuppliersService) {}

  @Get()
  @RequirePermissions('accounting:read')
  findAll(@Query() dto: ListSuppliersDto) {
    return this.service.findAll(dto);
  }

  @Get('stats')
  @RequirePermissions('accounting:read')
  getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @RequirePermissions('accounting:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('accounting:write')
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('accounting:write')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('accounting:write')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
```

**Commit:**
```bash
git add apps/api/src/accounting/
git commit -m "feat(api): add SuppliersController with full CRUD and stats"
```

---

## Task 4: NestJS — PurchaseInvoicesController + Service

**Files to create:**
- `apps/api/src/accounting/dto/create-purchase-invoice.dto.ts`
- `apps/api/src/accounting/dto/list-purchase-invoices.dto.ts`
- `apps/api/src/accounting/purchase-invoices.service.ts`
- `apps/api/src/accounting/purchase-invoices.controller.ts`

### Step 1: `apps/api/src/accounting/dto/create-purchase-invoice.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreatePurchaseInvoiceSchema = z.object({
  reference: z.string().min(1).max(100),
  supplierId: z.string().uuid(),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  totalHt: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).max(100).default(20),
  notes: z.string().max(2000).optional().or(z.literal('')),
}).transform((data) => {
  const vatAmount = data.totalHt * (data.vatRate / 100);
  const totalTtc = data.totalHt + vatAmount;
  return { ...data, vatAmount, totalTtc };
});

export class CreatePurchaseInvoiceDto extends createZodDto(CreatePurchaseInvoiceSchema) {}

export const UpdatePurchaseInvoiceSchema = z.object({
  reference: z.string().min(1).max(100).optional(),
  supplierId: z.string().uuid().optional(),
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  status: z.enum(['en_attente', 'validee', 'payee_partiellement', 'payee', 'annulee']).optional(),
  totalHt: z.coerce.number().min(0).optional(),
  vatAmount: z.coerce.number().min(0).optional(),
  totalTtc: z.coerce.number().min(0).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
  fileUrl: z.string().url().optional().nullable(),
});

export class UpdatePurchaseInvoiceDto extends createZodDto(UpdatePurchaseInvoiceSchema) {}
```

### Step 2: `apps/api/src/accounting/dto/list-purchase-invoices.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListPurchaseInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export class ListPurchaseInvoicesDto extends createZodDto(ListPurchaseInvoicesSchema) {}
```

### Step 3: `apps/api/src/accounting/purchase-invoices.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseInvoiceDto, UpdatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { ListPurchaseInvoicesDto } from './dto/list-purchase-invoices.dto';

@Injectable()
export class PurchaseInvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListPurchaseInvoicesDto) {
    const { page, limit, search, supplierId, status, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(supplierId ? { supplierId } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate ? {
        invoiceDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' as const } },
          { supplier: { name: { contains: search, mode: 'insensitive' as const } } },
          { notes: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where, skip, take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { invoiceDate: 'desc' },
      }),
      this.prisma.purchaseInvoice.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
      },
    });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    return invoice;
  }

  async create(dto: CreatePurchaseInvoiceDto) {
    const existing = await this.prisma.purchaseInvoice.findUnique({
      where: { reference: dto.reference },
    });
    if (existing) throw new BadRequestException(`Reference "${dto.reference}" already exists`);

    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const { vatRate, ...data } = dto;
    return this.prisma.purchaseInvoice.create({
      data,
      include: { supplier: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdatePurchaseInvoiceDto) {
    await this.findOne(id);

    // If reference is updated, check uniqueness
    if (dto.reference) {
      const existing = await this.prisma.purchaseInvoice.findFirst({
        where: { reference: dto.reference, id: { not: id } },
      });
      if (existing) throw new BadRequestException(`Reference "${dto.reference}" already exists`);
    }

    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: dto,
      include: { supplier: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.purchaseInvoice.delete({ where: { id } });
  }

  /** Upload file URL (called after Supabase Storage upload on the client side). */
  async attachFile(id: string, fileUrl: string) {
    await this.findOne(id);
    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: { fileUrl },
    });
  }

  async getStats() {
    const [total, byStatus, sums] = await Promise.all([
      this.prisma.purchaseInvoice.count(),
      this.prisma.purchaseInvoice.groupBy({ by: ['status'], _count: true }),
      this.prisma.purchaseInvoice.aggregate({
        _sum: { totalHt: true, totalTtc: true, amountPaid: true },
      }),
    ]);

    const overdue = await this.prisma.purchaseInvoice.count({
      where: {
        status: 'en_attente',
        dueDate: { lt: new Date() },
      },
    });

    return {
      total,
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      totalHt: Number(sums._sum.totalHt ?? 0),
      totalTtc: Number(sums._sum.totalTtc ?? 0),
      amountPaid: Number(sums._sum.amountPaid ?? 0),
      amountDue: Number(sums._sum.totalTtc ?? 0) - Number(sums._sum.amountPaid ?? 0),
      overdue,
    };
  }
}
```

### Step 4: `apps/api/src/accounting/purchase-invoices.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { CreatePurchaseInvoiceDto, UpdatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { ListPurchaseInvoicesDto } from './dto/list-purchase-invoices.dto';

@Controller('purchase-invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseInvoicesController {
  constructor(private service: PurchaseInvoicesService) {}

  @Get()
  @RequirePermissions('accounting:read')
  findAll(@Query() dto: ListPurchaseInvoicesDto) {
    return this.service.findAll(dto);
  }

  @Get('stats')
  @RequirePermissions('accounting:read')
  getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @RequirePermissions('accounting:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('accounting:write')
  create(@Body() dto: CreatePurchaseInvoiceDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('accounting:write')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseInvoiceDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/file')
  @RequirePermissions('accounting:write')
  attachFile(@Param('id') id: string, @Body('fileUrl') fileUrl: string) {
    return this.service.attachFile(id, fileUrl);
  }

  @Delete(':id')
  @RequirePermissions('accounting:write')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
```

**Commit:**
```bash
git add apps/api/src/accounting/
git commit -m "feat(api): add PurchaseInvoicesController with CRUD, file attach, VAT calc, and stats"
```

---

## Task 5: NestJS — ExpenseReportsController + Service (with N+1 approval workflow)

**Files to create:**
- `apps/api/src/accounting/dto/create-expense-report.dto.ts`
- `apps/api/src/accounting/dto/list-expense-reports.dto.ts`
- `apps/api/src/accounting/expense-reports.service.ts`
- `apps/api/src/accounting/expense-reports.controller.ts`

### Step 1: `apps/api/src/accounting/dto/create-expense-report.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateExpenseReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  amount: z.coerce.number().min(0),
  vatAmount: z.coerce.number().min(0).optional(),
  expenseDate: z.coerce.date(),
  receiptUrl: z.string().url().optional().nullable(),
  currencyId: z.string().uuid().optional(),
});

export class CreateExpenseReportDto extends createZodDto(CreateExpenseReportSchema) {}
export class UpdateExpenseReportDto extends createZodDto(CreateExpenseReportSchema.partial()) {}

export const ApproveExpenseSchema = z.object({
  action: z.enum(['approuve', 'refuse']),
  comment: z.string().max(500).optional(),
});

export class ApproveExpenseDto extends createZodDto(ApproveExpenseSchema) {}
```

### Step 2: `apps/api/src/accounting/dto/list-expense-reports.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListExpenseReportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  pendingApproval: z.enum(['true', 'false']).optional(),
});

export class ListExpenseReportsDto extends createZodDto(ListExpenseReportsSchema) {}
```

### Step 3: `apps/api/src/accounting/expense-reports.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseReportDto, UpdateExpenseReportDto, ApproveExpenseDto } from './dto/create-expense-report.dto';
import { ListExpenseReportsDto } from './dto/list-expense-reports.dto';

@Injectable()
export class ExpenseReportsService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListExpenseReportsDto) {
    const { page, limit, search, employeeId, status, startDate, endDate, pendingApproval } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate ? {
        expenseDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      } : {}),
      ...(pendingApproval === 'true' ? { status: 'en_attente' } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { employee: { firstName: { contains: search, mode: 'insensitive' as const } } },
          { employee: { lastName: { contains: search, mode: 'insensitive' as const } } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expenseReport.findMany({
        where, skip, take: limit,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
          currency: { select: { code: true, symbol: true } },
        },
        orderBy: { expenseDate: 'desc' },
      }),
      this.prisma.expenseReport.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const report = await this.prisma.expenseReport.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, email: true, managerId: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        currency: { select: { code: true, symbol: true } },
      },
    });
    if (!report) throw new NotFoundException('Expense report not found');
    return report;
  }

  /**
   * Create expense report. The employeeId is derived from the authenticated user's
   * associated employee record. The N+1 manager (approver) is auto-assigned from
   * the employee's managerId.
   */
  async create(dto: CreateExpenseReportDto, userId: string) {
    // Find the employee associated with the current user
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      select: { id: true, managerId: true },
    });
    if (!employee) throw new BadRequestException('No employee record linked to your user account');

    return this.prisma.expenseReport.create({
      data: {
        ...dto,
        employeeId: employee.id,
        approverId: employee.managerId, // N+1 auto-assigned
        status: 'en_attente',
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        currency: { select: { code: true, symbol: true } },
      },
    });
    // TODO: Trigger notification to N+1 manager (use NotificationsService from Sprint 3B)
  }

  async update(id: string, dto: UpdateExpenseReportDto, userId: string) {
    const report = await this.findOne(id);

    // Only the employee who created the report can update it, and only if still pending
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (report.employeeId !== employee?.id) {
      throw new ForbiddenException('You can only modify your own expense reports');
    }
    if (report.status !== 'en_attente') {
      throw new BadRequestException('Cannot modify an expense report that is not pending');
    }

    return this.prisma.expenseReport.update({
      where: { id },
      data: dto,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        currency: { select: { code: true, symbol: true } },
      },
    });
  }

  /**
   * Approve or refuse an expense report.
   * Only the assigned approver (N+1) or super_admin/comptable can do this.
   */
  async approve(id: string, dto: ApproveExpenseDto, userId: string) {
    const report = await this.findOne(id);

    if (report.status !== 'en_attente') {
      throw new BadRequestException('This expense report is not pending approval');
    }

    // Check that current user is the approver, or has comptable/super_admin role
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });

    const isApprover = employee && report.approverId === employee.id;
    const isPrivileged = user && ['super_admin', 'comptable', 'gerant'].includes(user.role);

    if (!isApprover && !isPrivileged) {
      throw new ForbiddenException('You are not authorized to approve this expense report');
    }

    return this.prisma.expenseReport.update({
      where: { id },
      data: { status: dto.action },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    // TODO: Trigger notification to employee (approved/refused)
  }

  /** Mark an approved expense report as reimbursed. */
  async markReimbursed(id: string) {
    const report = await this.findOne(id);
    if (report.status !== 'approuve') {
      throw new BadRequestException('Only approved expense reports can be marked as reimbursed');
    }
    return this.prisma.expenseReport.update({
      where: { id },
      data: { status: 'rembourse' },
    });
  }

  async remove(id: string, userId: string) {
    const report = await this.findOne(id);
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (report.employeeId !== employee?.id) {
      throw new ForbiddenException('You can only delete your own expense reports');
    }
    if (report.status !== 'en_attente') {
      throw new BadRequestException('Cannot delete an expense report that is not pending');
    }
    return this.prisma.expenseReport.delete({ where: { id } });
  }

  async getStats(userId?: string) {
    const where = userId
      ? { employee: { userId } }
      : {};

    const [total, byStatus, sums] = await Promise.all([
      this.prisma.expenseReport.count({ where }),
      this.prisma.expenseReport.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.expenseReport.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const pendingApproval = await this.prisma.expenseReport.count({
      where: { status: 'en_attente' },
    });

    return {
      total,
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count,
        total: Number(s._sum.amount ?? 0),
      })),
      totalAmount: Number(sums._sum.amount ?? 0),
      pendingApproval,
    };
  }
}
```

### Step 4: `apps/api/src/accounting/expense-reports.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { ExpenseReportsService } from './expense-reports.service';
import { CreateExpenseReportDto, UpdateExpenseReportDto, ApproveExpenseDto } from './dto/create-expense-report.dto';
import { ListExpenseReportsDto } from './dto/list-expense-reports.dto';

@Controller('expense-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpenseReportsController {
  constructor(private service: ExpenseReportsService) {}

  @Get()
  @RequirePermissions('accounting:read')
  findAll(@Query() dto: ListExpenseReportsDto) {
    return this.service.findAll(dto);
  }

  @Get('stats')
  @RequirePermissions('accounting:read')
  getStats(@Request() req: any) {
    return this.service.getStats(req.user?.id);
  }

  @Get(':id')
  @RequirePermissions('accounting:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('accounting:write')
  create(@Body() dto: CreateExpenseReportDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions('accounting:write')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseReportDto, @Request() req: any) {
    return this.service.update(id, dto, req.user.id);
  }

  @Post(':id/approve')
  @RequirePermissions('accounting:approve')
  approve(@Param('id') id: string, @Body() dto: ApproveExpenseDto, @Request() req: any) {
    return this.service.approve(id, dto, req.user.id);
  }

  @Patch(':id/reimburse')
  @RequirePermissions('accounting:write')
  markReimbursed(@Param('id') id: string) {
    return this.service.markReimbursed(id);
  }

  @Delete(':id')
  @RequirePermissions('accounting:write')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.id);
  }
}
```

**Commit:**
```bash
git add apps/api/src/accounting/
git commit -m "feat(api): add ExpenseReportsController with N+1 approval workflow"
```

---

## Task 6: NestJS — AccountingModule registration

**File to create:** `apps/api/src/accounting/accounting.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { PurchaseInvoicesController } from './purchase-invoices.controller';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { ExpenseReportsController } from './expense-reports.controller';
import { ExpenseReportsService } from './expense-reports.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SuppliersController, PurchaseInvoicesController, ExpenseReportsController],
  providers: [SuppliersService, PurchaseInvoicesService, ExpenseReportsService],
  exports: [SuppliersService, PurchaseInvoicesService, ExpenseReportsService],
})
export class AccountingModule {}
```

**Edit** `apps/api/src/app.module.ts`: Import and add `AccountingModule` to the `imports` array.

```typescript
import { AccountingModule } from './accounting/accounting.module';

// In @Module.imports array, add:
AccountingModule,
```

**Commit:**
```bash
git add apps/api/src/accounting/accounting.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): register AccountingModule in AppModule"
```

---

## Task 7: Next.js — API helper (`apps/web/src/lib/accounting-api.ts`)

Create the frontend API helper with TanStack Query hooks for all accounting endpoints.

**File to create:** `apps/web/src/lib/accounting-api.ts`

```typescript
import { api } from './api';

// ── Suppliers ──
export const suppliersApi = {
  list: (params?: Record<string, any>) => api.get('/suppliers', { params }).then(r => r.data),
  stats: () => api.get('/suppliers/stats').then(r => r.data),
  get: (id: string) => api.get(`/suppliers/${id}`).then(r => r.data),
  create: (data: any) => api.post('/suppliers', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/suppliers/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/suppliers/${id}`).then(r => r.data),
};

// ── Purchase Invoices ──
export const purchaseInvoicesApi = {
  list: (params?: Record<string, any>) => api.get('/purchase-invoices', { params }).then(r => r.data),
  stats: () => api.get('/purchase-invoices/stats').then(r => r.data),
  get: (id: string) => api.get(`/purchase-invoices/${id}`).then(r => r.data),
  create: (data: any) => api.post('/purchase-invoices', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/purchase-invoices/${id}`, data).then(r => r.data),
  attachFile: (id: string, fileUrl: string) => api.patch(`/purchase-invoices/${id}/file`, { fileUrl }).then(r => r.data),
  remove: (id: string) => api.delete(`/purchase-invoices/${id}`).then(r => r.data),
};

// ── Expense Reports ──
export const expenseReportsApi = {
  list: (params?: Record<string, any>) => api.get('/expense-reports', { params }).then(r => r.data),
  stats: () => api.get('/expense-reports/stats').then(r => r.data),
  get: (id: string) => api.get(`/expense-reports/${id}`).then(r => r.data),
  create: (data: any) => api.post('/expense-reports', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/expense-reports/${id}`, data).then(r => r.data),
  approve: (id: string, data: { action: string; comment?: string }) =>
    api.post(`/expense-reports/${id}/approve`, data).then(r => r.data),
  reimburse: (id: string) => api.patch(`/expense-reports/${id}/reimburse`).then(r => r.data),
  remove: (id: string) => api.delete(`/expense-reports/${id}`).then(r => r.data),
};
```

**Commit:**
```bash
git add apps/web/src/lib/accounting-api.ts
git commit -m "feat(web): add accounting API helper functions"
```

---

## Task 8: Next.js — Suppliers page (`/accounting/suppliers`)

**Files to create:**
- `apps/web/src/app/(app)/accounting/layout.tsx` — Sub-layout with sidebar tabs (Fournisseurs, Factures achats, Notes de frais)
- `apps/web/src/app/(app)/accounting/suppliers/page.tsx` — Suppliers list

### Step 1: `apps/web/src/app/(app)/accounting/layout.tsx`

```tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Building2, FileText, Receipt } from 'lucide-react';

const tabs = [
  { label: 'Fournisseurs', href: '/accounting/suppliers', icon: Building2 },
  { label: 'Factures achats', href: '/accounting/purchase-invoices', icon: FileText },
  { label: 'Notes de frais', href: '/accounting/expense-reports', icon: Receipt },
];

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
```

### Step 2: `apps/web/src/app/(app)/accounting/suppliers/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/accounting-api';
import { StatsBar } from '@exeteam/ui';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Building2, CheckCircle, XCircle, Euro } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { SupplierFormDialog } from './supplier-form-dialog';

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['suppliers', 'stats'],
    queryFn: suppliersApi.stats,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', { page, search: debouncedSearch }],
    queryFn: () => suppliersApi.list({ page, limit: 20, search: debouncedSearch }),
  });

  const columns = [
    { accessorKey: 'name', header: 'Nom' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Téléphone' },
    { accessorKey: 'siret', header: 'SIRET' },
    {
      accessorKey: 'isActive',
      header: 'Statut',
      cell: ({ row }: any) => (
        <span className={row.original.isActive ? 'text-green-600' : 'text-gray-400'}>
          {row.original.isActive ? 'Actif' : 'Inactif'}
        </span>
      ),
    },
    {
      accessorKey: '_count.purchaseInvoices',
      header: 'Factures',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fournisseurs</h1>
        <Button onClick={() => { setEditingSupplier(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau fournisseur
        </Button>
      </div>

      {stats && (
        <StatsBar
          items={[
            { label: 'Total', value: stats.total, icon: Building2 },
            { label: 'Actifs', value: stats.active, icon: CheckCircle },
            { label: 'Inactifs', value: stats.inactive, icon: XCircle },
            { label: 'Total achats HT', value: `${stats.totalPurchaseHt.toLocaleString('fr-FR')} €`, icon: Euro },
          ]}
        />
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        pagination={{ page, total: data?.pages ?? 1, onChange: setPage }}
        onRowClick={(row: any) => { setEditingSupplier(row); setDialogOpen(true); }}
      />

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['suppliers'] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
```

### Step 3: `apps/web/src/app/(app)/accounting/suppliers/supplier-form-dialog.tsx`

Create a dialog component using shadcn/ui `Dialog` + `react-hook-form` + `zod` for create/edit supplier. Fields: name (required), email, phone, address, vatNumber, siret, isActive toggle.

Follow the same pattern used in Sprint 2A client form dialogs.

**Commit:**
```bash
git add apps/web/src/app/\(app\)/accounting/
git commit -m "feat(web): add accounting layout and suppliers list page with StatsBar"
```

---

## Task 9: Next.js — Purchase Invoices page (`/accounting/purchase-invoices`)

**Files to create:**
- `apps/web/src/app/(app)/accounting/purchase-invoices/page.tsx`
- `apps/web/src/app/(app)/accounting/purchase-invoices/purchase-invoice-form-dialog.tsx`

### Step 1: Purchase Invoices list page

List with StatsBar (4 KPIs: Total factures, Total HT, Montant dû, En retard), search, filters (supplier dropdown, status dropdown, date range), DataTable with columns: Référence, Fournisseur, Date, Échéance, Total HT, Total TTC, Payé, Statut. Status badges using `PURCHASE_INVOICE_STATUS_COLORS`. "+ Nouvelle facture" button opens form dialog.

### Step 2: Form dialog

Dialog with fields:
- reference (text, required)
- supplierId (select dropdown from suppliersApi.list, required)
- invoiceDate (date picker, required)
- dueDate (date picker, optional)
- totalHt (number, required)
- vatRate (select from VAT_RATES, default 20%)
- Auto-computed: vatAmount = totalHt × vatRate/100, totalTtc = totalHt + vatAmount (displayed read-only)
- notes (textarea, optional)
- File upload: upload PDF to Supabase Storage `purchase-invoices/` bucket, then call `attachFile` endpoint

Follow the same pattern as Sprint 3C invoice forms.

**Commit:**
```bash
git add apps/web/src/app/\(app\)/accounting/purchase-invoices/
git commit -m "feat(web): add purchase invoices list page with VAT rate selector and file upload"
```

---

## Task 10: Next.js — Expense Reports page (`/accounting/expense-reports`)

**Files to create:**
- `apps/web/src/app/(app)/accounting/expense-reports/page.tsx`
- `apps/web/src/app/(app)/accounting/expense-reports/expense-form-dialog.tsx`
- `apps/web/src/app/(app)/accounting/expense-reports/approve-dialog.tsx`

### Step 1: Expense Reports list page

List with StatsBar (4 KPIs: Total notes, En attente, Montant total, À approuver), search, filters (employee dropdown, status dropdown, date range, "Mes notes" toggle), DataTable with columns: Titre, Employé, Montant, Date, Statut, Approbateur. Status badges using `EXPENSE_REPORT_STATUS_COLORS`. "+ Nouvelle note de frais" button.

### Step 2: Expense form dialog

Dialog with fields:
- title (text, required)
- description (textarea, optional)
- amount (number, required)
- vatAmount (number, optional)
- expenseDate (date picker, required)
- currencyId (select, optional)
- Receipt upload: upload image/PDF to Supabase Storage `expense-receipts/` bucket

### Step 3: Approve dialog

Shown when a manager clicks on a pending expense report they need to approve. Two buttons: "Approuver" (green) and "Refuser" (red), with optional comment field. Calls `expenseReportsApi.approve(id, { action, comment })`.

### Step 4: Reimbursement action

For approved expense reports, comptable/gerant sees a "Marquer remboursé" button that calls `expenseReportsApi.reimburse(id)`.

**Commit:**
```bash
git add apps/web/src/app/\(app\)/accounting/expense-reports/
git commit -m "feat(web): add expense reports page with N+1 approval workflow UI"
```

---

## Task 11: Next.js — Accounting overview/redirect page

**File to create:** `apps/web/src/app/(app)/accounting/page.tsx`

Redirect to `/accounting/suppliers` by default (or show a mini dashboard with all 3 sections' stats).

```tsx
import { redirect } from 'next/navigation';

export default function AccountingPage() {
  redirect('/accounting/suppliers');
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/accounting/page.tsx
git commit -m "feat(web): add accounting redirect page"
```

---

## Task 12: Navigation — Add "Comptabilité" to sidebar

**Edit:** `apps/web/src/components/sidebar.tsx` (or equivalent navigation component)

Add a new sidebar item in the appropriate section:

```typescript
{
  label: 'Comptabilité',
  href: '/accounting/suppliers',
  icon: Calculator, // from lucide-react
  permissions: ['accounting:read'],
  children: [
    { label: 'Fournisseurs', href: '/accounting/suppliers' },
    { label: 'Factures achats', href: '/accounting/purchase-invoices' },
    { label: 'Notes de frais', href: '/accounting/expense-reports' },
  ],
}
```

This should be placed after the "Commercial" section in the sidebar.

**Commit:**
```bash
git add apps/web/src/components/
git commit -m "feat(web): add Comptabilité section to sidebar navigation"
```

---

## Task 13: Permissions — Add accounting permissions

**Edit:** The permissions configuration file (check the existing pattern from Sprint 1 auth setup).

Add permissions:
- `accounting:read` — View suppliers, purchase invoices, expense reports
- `accounting:write` — Create/edit/delete suppliers, purchase invoices, expense reports
- `accounting:approve` — Approve/refuse expense reports

**Role mapping:**
| Permission | super_admin | gerant | comptable | responsable_production | employe |
|---|---|---|---|---|---|
| accounting:read | ✓ | ✓ | ✓ | ✗ | own only |
| accounting:write | ✓ | ✓ | ✓ | ✗ | own expenses |
| accounting:approve | ✓ | ✓ | ✓ | ✗ | ✗ |

**Commit:**
```bash
git add apps/api/src/auth/
git commit -m "feat(api): add accounting permissions (read, write, approve)"
```

---

## Task 14: Verification — build and type-check

```bash
cd /Users/ismael/Documents/_exeteam/_sources/exeteam
pnpm build
pnpm typecheck
```

Fix any TypeScript errors or build failures.

**Commit (if fixes needed):**
```bash
git add -A && git commit -m "fix: resolve build errors in accounting module"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create `feat/accounting` branch |
| 2 | Shared types + enums (purchase invoice/expense statuses, VAT_RATES) |
| 3 | NestJS SuppliersController + Service (CRUD, stats) |
| 4 | NestJS PurchaseInvoicesController + Service (CRUD, VAT calc, file attach, stats) |
| 5 | NestJS ExpenseReportsController + Service (CRUD, N+1 approval, reimburse) |
| 6 | AccountingModule registration in AppModule |
| 7 | Next.js API helper (accounting-api.ts) |
| 8 | Suppliers list page with StatsBar + form dialog |
| 9 | Purchase invoices list page with VAT selector + file upload |
| 10 | Expense reports page with approval workflow UI |
| 11 | Accounting redirect/overview page |
| 12 | Sidebar navigation entry |
| 13 | Accounting permissions setup |
| 14 | Build verification |
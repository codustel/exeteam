# ExeTeam Sprint 3C — Module Commercial

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Branch:** `feat/commercial`

**Goal:** Attachments (bordereaux from facturable tasks), Quotes, Orders, Invoices — full CRUD, PDF generation with React-PDF and ExeTeam branding, currency symbol on all amounts.

**Prerequisite:** Sprint 2 complete. Sprint 3A TasksModule must be available (facturable flag on tasks).

**Tech Stack:** NestJS · Prisma · Zod DTOs · TanStack Query · shadcn/ui · @react-pdf/renderer

---

## Task 1: Create branch

```bash
git checkout main && git pull
git checkout -b feat/commercial
```

---

## Task 2: Install @react-pdf/renderer

```bash
pnpm add @react-pdf/renderer --filter web
```

---

## Task 3: NestJS — AttachmentsModule

An attachment (bordereau) groups facturable tasks by client/project/period. Lines are generated from tasks where `facturable = true`.

**Files:**
- `apps/api/src/commercial/dto/create-attachment.dto.ts`
- `apps/api/src/commercial/dto/list-attachments.dto.ts`
- `apps/api/src/commercial/attachments.service.ts`
- `apps/api/src/commercial/attachments.controller.ts`

### Step 1: `apps/api/src/commercial/dto/create-attachment.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateAttachmentSchema = z.object({
  reference: z.string().min(1).max(100),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  currencyId: z.string().uuid().optional(),
  // Task IDs to include as lines (must have facturable=true)
  taskIds: z.array(z.string().uuid()).min(1, 'Au moins une tâche requise'),
});

export class CreateAttachmentDto extends createZodDto(CreateAttachmentSchema) {}
export class UpdateAttachmentDto extends createZodDto(CreateAttachmentSchema.partial()) {}
```

### Step 2: `apps/api/src/commercial/dto/list-attachments.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListAttachmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  period: z.string().optional(),
  status: z.string().optional(),
});

export class ListAttachmentsDto extends createZodDto(ListAttachmentsSchema) {}
```

### Step 3: `apps/api/src/commercial/attachments.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttachmentDto, UpdateAttachmentDto } from './dto/create-attachment.dto';
import { ListAttachmentsDto } from './dto/list-attachments.dto';

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListAttachmentsDto) {
    const { page, limit, search, clientId, projectId, period, status } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(period ? { period } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.attachment.findMany({
        where, skip, take: limit,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, reference: true, title: true } },
          currency: { select: { code: true, symbol: true } },
          _count: { select: { lines: true, invoices: true } },
        },
        orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.attachment.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const att = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, addressLine1: true, city: true } },
        project: { select: { id: true, reference: true, title: true } },
        currency: { select: { code: true, symbol: true } },
        lines: {
          include: {
            task: {
              select: {
                id: true, reference: true, title: true,
                codeProduit: { select: { code: true, designation: true, unitType: true, unitPrice: true } },
                site: { select: { reference: true } },
              },
            },
          },
        },
        invoices: { select: { id: true, reference: true, status: true, totalTtc: true } },
      },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }

  // Generate attachment from facturable tasks
  async create(dto: CreateAttachmentDto) {
    const existing = await this.prisma.attachment.findUnique({ where: { reference: dto.reference } });
    if (existing) throw new BadRequestException(`Attachment "${dto.reference}" already exists`);

    // Load tasks and validate facturable
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: dto.taskIds }, facturable: true, deletedAt: null },
      include: {
        codeProduit: { select: { code: true, designation: true, unitPrice: true, unitType: true } },
        site: { select: { reference: true } },
        timeEntries: { select: { hours: true } },
      },
    });

    if (tasks.length === 0) {
      throw new BadRequestException('No facturable tasks found for the given IDs');
    }

    const nonFacturable = dto.taskIds.filter(id => !tasks.find(t => t.id === id));
    if (nonFacturable.length > 0) {
      throw new BadRequestException(
        `Tasks not found or not facturable: ${nonFacturable.join(', ')}`,
      );
    }

    // Build lines + compute total
    let totalHt = 0;
    const linesData = tasks.map(task => {
      const realHours = task.timeEntries.reduce((s, te) => s + Number(te.hours), 0);
      const unitPrice = Number(task.codeProduit?.unitPrice ?? 0);
      // Qty = 1 for piece/forfait, realHours for heure
      const qty = task.codeProduit?.unitType === 'heure' ? realHours : 1;
      const lineTotal = unitPrice * qty;
      totalHt += lineTotal;
      return { taskId: task.id, quantity: qty, unitPrice, total: lineTotal };
    });

    return this.prisma.attachment.create({
      data: {
        reference: dto.reference,
        clientId: dto.clientId,
        projectId: dto.projectId,
        period: dto.period,
        currencyId: dto.currencyId,
        totalHt,
        status: 'genere',
        lines: { create: linesData },
      },
      include: {
        client: { select: { id: true, name: true } },
        lines: true,
        currency: { select: { code: true, symbol: true } },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);
    return this.prisma.attachment.update({ where: { id }, data: { status } });
  }

  // Get facturable tasks for period/client (to show in generation UI)
  async getFacturableTasks(clientId: string, period: string) {
    // period = "2024-01", filter tasks actualEndDate within month
    const [year, month] = period.split('-').map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);

    return this.prisma.task.findMany({
      where: {
        facturable: true,
        deletedAt: null,
        project: { clientId },
        actualEndDate: { gte: from, lte: to },
        // Not already in an attachment
        attachmentLine: { none: {} },
      },
      include: {
        codeProduit: { select: { code: true, designation: true, unitPrice: true, unitType: true } },
        site: { select: { reference: true } },
        project: { select: { reference: true } },
        timeEntries: { select: { hours: true } },
      },
      orderBy: [{ project: { reference: 'asc' } }, { codeProduit: { code: 'asc' } }],
    });
  }

  async getStats() {
    const [total, byStatus] = await Promise.all([
      this.prisma.attachment.count(),
      this.prisma.attachment.groupBy({ by: ['status'], _count: true }),
    ]);
    const pendingAmount = await this.prisma.attachment.aggregate({
      where: { status: { in: ['genere', 'envoye'] } },
      _sum: { totalHt: true },
    });
    return {
      total,
      byStatus,
      pendingAmount: Number(pendingAmount._sum.totalHt ?? 0),
    };
  }
}
```

### Step 4: `apps/api/src/commercial/attachments.controller.ts`

```typescript
import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { ListAttachmentsDto } from './dto/list-attachments.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('commercial/attachments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Get('stats')
  @RequirePermissions('commercial.read')
  getStats() { return this.attachmentsService.getStats(); }

  @Get('facturable-tasks')
  @RequirePermissions('commercial.read')
  getFacturableTasks(@Query('clientId') clientId: string, @Query('period') period: string) {
    return this.attachmentsService.getFacturableTasks(clientId, period);
  }

  @Get()
  @RequirePermissions('commercial.read')
  findAll(@Query() dto: ListAttachmentsDto) { return this.attachmentsService.findAll(dto); }

  @Get(':id')
  @RequirePermissions('commercial.read')
  findOne(@Param('id') id: string) { return this.attachmentsService.findOne(id); }

  @Post()
  @RequirePermissions('commercial.create')
  create(@Body() dto: CreateAttachmentDto) { return this.attachmentsService.create(dto); }

  @Patch(':id/status')
  @RequirePermissions('commercial.update')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.attachmentsService.updateStatus(id, body.status);
  }
}
```

---

## Task 4: NestJS — QuotesModule

**Files:**
- `apps/api/src/commercial/dto/create-quote.dto.ts`
- `apps/api/src/commercial/quotes.service.ts`
- `apps/api/src/commercial/quotes.controller.ts`

### Step 1: `apps/api/src/commercial/dto/create-quote.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const QuoteLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).max(100).optional().default(20),
});

export const CreateQuoteSchema = z.object({
  reference: z.string().min(1).max(100),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  quoteDate: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  status: z.enum(['brouillon', 'envoye', 'accepte', 'refuse', 'expire']).optional().default('brouillon'),
  vatRate: z.coerce.number().min(0).max(100).optional().default(20),
  discount: z.coerce.number().min(0).max(100).optional(),
  currencyId: z.string().uuid().optional(),
  conditions: z.string().optional(),
  lines: z.array(QuoteLineSchema).min(1),
});

export class CreateQuoteDto extends createZodDto(CreateQuoteSchema) {}
export class UpdateQuoteDto extends createZodDto(CreateQuoteSchema.partial()) {}
```

### Step 2: `apps/api/src/commercial/quotes.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/create-quote.dto';

function computeTotals(lines: Array<{ quantity: number; unitPrice: number; vatRate?: number }>, globalVatRate: number, discount?: number) {
  const totalHtBeforeDiscount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discountMultiplier = discount ? (1 - discount / 100) : 1;
  const totalHt = totalHtBeforeDiscount * discountMultiplier;
  const vatAmount = totalHt * (globalVatRate / 100);
  const totalTtc = totalHt + vatAmount;
  return { totalHt, vatAmount, totalTtc };
}

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number; limit?: number; clientId?: string; status?: string; search?: string;
  }) {
    const { page = 1, limit = 20, clientId, status, search } = params;
    const skip = (page - 1) * limit;
    const where: any = {
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({
        where, skip, take: limit,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, reference: true } },
          currency: { select: { code: true, symbol: true } },
          _count: { select: { lines: true, orders: true } },
        },
        orderBy: { quoteDate: 'desc' },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, addressLine1: true, city: true, vatNumber: true } },
        project: { select: { id: true, reference: true, title: true } },
        currency: { select: { code: true, symbol: true } },
        lines: { orderBy: { id: 'asc' } },
        orders: { select: { id: true, reference: true, status: true } },
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async create(dto: CreateQuoteDto) {
    const existing = await this.prisma.quote.findUnique({ where: { reference: dto.reference } });
    if (existing) throw new BadRequestException(`Quote "${dto.reference}" already exists`);

    const { lines, vatRate = 20, discount, ...data } = dto;
    const { totalHt, vatAmount, totalTtc } = computeTotals(lines, vatRate, discount);

    return this.prisma.quote.create({
      data: {
        ...data, vatRate, discount, totalHt, vatAmount, totalTtc,
        lines: { create: lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate ?? vatRate,
          total: l.quantity * l.unitPrice,
        })) },
      },
      include: {
        client: { select: { id: true, name: true } },
        lines: true,
        currency: { select: { code: true, symbol: true } },
      },
    });
  }

  async update(id: string, dto: UpdateQuoteDto) {
    await this.findOne(id);
    const { lines, vatRate, discount, ...data } = dto;
    const totals = lines ? computeTotals(lines, vatRate ?? 20, discount) : {};

    return this.prisma.quote.update({
      where: { id },
      data: {
        ...data, ...(vatRate !== undefined ? { vatRate } : {}),
        ...(discount !== undefined ? { discount } : {}),
        ...totals,
        ...(lines ? {
          lines: {
            deleteMany: {},
            create: lines.map(l => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              vatRate: l.vatRate ?? (vatRate ?? 20),
              total: l.quantity * l.unitPrice,
            })),
          },
        } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        lines: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.quote.delete({ where: { id } });
  }
}
```

### Step 3: `apps/api/src/commercial/quotes.controller.ts`

```typescript
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/create-quote.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('commercial/quotes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Get()
  @RequirePermissions('commercial.read')
  findAll(@Query() q: any) { return this.quotesService.findAll(q); }

  @Get(':id')
  @RequirePermissions('commercial.read')
  findOne(@Param('id') id: string) { return this.quotesService.findOne(id); }

  @Post()
  @RequirePermissions('commercial.create')
  create(@Body() dto: CreateQuoteDto) { return this.quotesService.create(dto); }

  @Patch(':id')
  @RequirePermissions('commercial.update')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('commercial.delete')
  remove(@Param('id') id: string) { return this.quotesService.remove(id); }
}
```

---

## Task 5: NestJS — InvoicesModule (simplified, follows same pattern)

**Files:**
- `apps/api/src/commercial/dto/create-invoice.dto.ts`
- `apps/api/src/commercial/invoices.service.ts`
- `apps/api/src/commercial/invoices.controller.ts`

### Step 1: `apps/api/src/commercial/dto/create-invoice.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const InvoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).max(100).optional().default(20),
});

export const CreateInvoiceSchema = z.object({
  reference: z.string().min(1).max(100),
  clientId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  attachmentId: z.string().uuid().optional(),
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(['brouillon', 'envoye', 'paye', 'retard', 'annule']).optional().default('brouillon'),
  vatRate: z.coerce.number().min(0).max(100).optional().default(20),
  currencyId: z.string().uuid().optional(),
  lines: z.array(InvoiceLineSchema).min(1),
});

export class CreateInvoiceDto extends createZodDto(CreateInvoiceSchema) {}
export class UpdateInvoiceDto extends createZodDto(CreateInvoiceSchema.partial()) {}
```

### Step 2: `apps/api/src/commercial/invoices.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/create-invoice.dto';

function computeTotals(lines: Array<{ quantity: number; unitPrice: number }>, vatRate: number) {
  const totalHt = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const vatAmount = totalHt * (vatRate / 100);
  return { totalHt, vatAmount, totalTtc: totalHt + vatAmount };
}

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; limit?: number; clientId?: string; status?: string; search?: string }) {
    const { page = 1, limit = 20, clientId, status, search } = params;
    const skip = (page - 1) * limit;
    const where: any = {
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { reference: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip, take: limit,
        include: {
          client: { select: { id: true, name: true } },
          order: { select: { id: true, reference: true } },
          currency: { select: { code: true, symbol: true } },
        },
        orderBy: { invoiceDate: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, addressLine1: true, city: true, vatNumber: true } },
        order: { select: { id: true, reference: true } },
        attachment: { select: { id: true, reference: true, period: true } },
        currency: { select: { code: true, symbol: true } },
        lines: { orderBy: { id: 'asc' } },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async create(dto: CreateInvoiceDto) {
    const existing = await this.prisma.invoice.findUnique({ where: { reference: dto.reference } });
    if (existing) throw new BadRequestException(`Invoice "${dto.reference}" already exists`);

    const { lines, vatRate = 20, ...data } = dto;
    const { totalHt, vatAmount, totalTtc } = computeTotals(lines, vatRate);

    return this.prisma.invoice.create({
      data: {
        ...data, vatRate, totalHt, vatAmount, totalTtc,
        lines: { create: lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate ?? vatRate,
          total: l.quantity * l.unitPrice,
        })) },
      },
      include: {
        client: { select: { id: true, name: true } },
        lines: true,
        currency: { select: { code: true, symbol: true } },
      },
    });
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    await this.findOne(id);
    const { lines, vatRate, ...data } = dto;
    const totals = lines ? computeTotals(lines, vatRate ?? 20) : {};
    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...data, ...(vatRate !== undefined ? { vatRate } : {}), ...totals,
        ...(lines ? {
          lines: {
            deleteMany: {},
            create: lines.map(l => ({
              description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
              vatRate: l.vatRate ?? (vatRate ?? 20), total: l.quantity * l.unitPrice,
            })),
          },
        } : {}),
      },
      include: { client: { select: { id: true, name: true } }, lines: true },
    });
  }

  async recordPayment(id: string, amount: number) {
    const inv = await this.findOne(id);
    const newPaid = Number(inv.amountPaid) + amount;
    const status = newPaid >= Number(inv.totalTtc) ? 'paye' : inv.status;
    return this.prisma.invoice.update({
      where: { id },
      data: { amountPaid: newPaid, status },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.invoice.delete({ where: { id } });
  }
}
```

### Step 3: `apps/api/src/commercial/invoices.controller.ts`

```typescript
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('commercial/invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('commercial.read')
  findAll(@Query() q: any) { return this.invoicesService.findAll(q); }

  @Get(':id')
  @RequirePermissions('commercial.read')
  findOne(@Param('id') id: string) { return this.invoicesService.findOne(id); }

  @Post()
  @RequirePermissions('commercial.create')
  create(@Body() dto: CreateInvoiceDto) { return this.invoicesService.create(dto); }

  @Patch(':id')
  @RequirePermissions('commercial.update')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, dto);
  }

  @Patch(':id/payment')
  @RequirePermissions('commercial.update')
  recordPayment(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.invoicesService.recordPayment(id, body.amount);
  }

  @Delete(':id')
  @RequirePermissions('commercial.delete')
  remove(@Param('id') id: string) { return this.invoicesService.remove(id); }
}
```

---

## Task 6: NestJS — CommercialModule (barrel)

**File:** `apps/api/src/commercial/commercial.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AttachmentsController, QuotesController, InvoicesController],
  providers: [AttachmentsService, QuotesService, InvoicesService],
  exports: [AttachmentsService, QuotesService, InvoicesService],
})
export class CommercialModule {}
```

Register `CommercialModule` in `apps/api/src/app.module.ts`.

```bash
git add apps/api/src/commercial/
git commit -m "feat(api): add CommercialModule (Attachments, Quotes, Invoices) with CRUD and totals"
```

---

## Task 7: Next.js — PDF templates

**File:** `apps/web/src/components/pdf/quote-pdf.tsx`

```tsx
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1A1A1A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  logo: { fontSize: 20, fontWeight: 'bold', color: '#FF6600' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#1A1A1A' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#666' },
  row: { flexDirection: 'row', borderBottom: '1pt solid #eee', paddingVertical: 4 },
  col: { flex: 1 },
  colWide: { flex: 3 },
  headerRow: { flexDirection: 'row', backgroundColor: '#FF6600', color: 'white', padding: 6, marginBottom: 2 },
  totalsSection: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', gap: 16, paddingVertical: 2 },
  totalLabel: { width: 120, textAlign: 'right', color: '#666' },
  totalValue: { width: 80, textAlign: 'right' },
  totalBold: { fontWeight: 'bold', fontSize: 12 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
});

interface QuotePDFProps {
  quote: {
    reference: string;
    quoteDate: string;
    validUntil?: string;
    status: string;
    client: { name: string; addressLine1?: string; city?: string; vatNumber?: string };
    lines: Array<{ description: string; quantity: number; unitPrice: number; vatRate: number; total: number }>;
    totalHt: number;
    vatAmount: number;
    totalTtc: number;
    vatRate: number;
    discount?: number;
    conditions?: string;
    currency?: { symbol: string };
  };
}

const fmt = (n: number, symbol = '€') => `${Number(n).toFixed(2)} ${symbol}`;

export function QuotePDF({ quote }: QuotePDFProps) {
  const sym = quote.currency?.symbol ?? '€';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>ExeTeam</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>Bureau d'Études</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.title}>DEVIS</Text>
            <Text style={{ fontWeight: 'bold' }}>N° {quote.reference}</Text>
            <Text style={{ color: '#666' }}>
              Date : {new Date(quote.quoteDate).toLocaleDateString('fr-FR')}
            </Text>
            {quote.validUntil && (
              <Text style={{ color: '#666' }}>
                Valide jusqu'au : {new Date(quote.validUntil).toLocaleDateString('fr-FR')}
              </Text>
            )}
          </View>
        </View>

        {/* Client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLIENT</Text>
          <Text style={{ fontWeight: 'bold' }}>{quote.client.name}</Text>
          {quote.client.addressLine1 && <Text>{quote.client.addressLine1}</Text>}
          {quote.client.city && <Text>{quote.client.city}</Text>}
          {quote.client.vatNumber && <Text>TVA: {quote.client.vatNumber}</Text>}
        </View>

        {/* Lines table */}
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.colWide}>Description</Text>
            <Text style={styles.col}>Qté</Text>
            <Text style={styles.col}>P.U. HT</Text>
            <Text style={styles.col}>TVA</Text>
            <Text style={styles.col}>Total HT</Text>
          </View>
          {quote.lines.map((line, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.colWide}>{line.description}</Text>
              <Text style={styles.col}>{line.quantity}</Text>
              <Text style={styles.col}>{fmt(line.unitPrice, sym)}</Text>
              <Text style={styles.col}>{line.vatRate}%</Text>
              <Text style={styles.col}>{fmt(line.total, sym)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{fmt(quote.totalHt, sym)}</Text>
          </View>
          {quote.discount && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Remise ({quote.discount}%)</Text>
              <Text style={styles.totalValue}>- {fmt(quote.totalHt * quote.discount / 100, sym)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA ({quote.vatRate}%)</Text>
            <Text style={styles.totalValue}>{fmt(quote.vatAmount, sym)}</Text>
          </View>
          <View style={[styles.totalRow, { borderTop: '1pt solid #1A1A1A', paddingTop: 4 }]}>
            <Text style={[styles.totalLabel, styles.totalBold]}>Total TTC</Text>
            <Text style={[styles.totalValue, styles.totalBold]}>{fmt(quote.totalTtc, sym)}</Text>
          </View>
        </View>

        {/* Conditions */}
        {quote.conditions && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>CONDITIONS</Text>
            <Text>{quote.conditions}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          ExeTeam SAS — TVA intracommunautaire FR XX XXX XXX XXX — SIRET XXX XXX XXX XXXXX
        </Text>
      </Page>
    </Document>
  );
}
```

**File:** `apps/web/src/components/pdf/invoice-pdf.tsx`

Follow the same structure as `QuotePDF` but with title "FACTURE", add:
- `invoiceDate`, `dueDate` fields
- `amountPaid` / `remainingBalance` in totals section

```bash
git add apps/web/src/components/pdf/
git commit -m "feat(web): add QuotePDF and InvoicePDF React-PDF templates with ExeTeam branding"
```

---

## Task 8: Next.js — API helpers + /commercial pages

### Step 1: `apps/web/src/lib/api/commercial.ts`

```typescript
import { apiRequest } from './client';

export const attachmentsApi = {
  list: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<any>(`/commercial/attachments?${qs}`);
  },
  getOne: (id: string) => apiRequest<any>(`/commercial/attachments/${id}`),
  getStats: () => apiRequest<any>('/commercial/attachments/stats'),
  getFacturableTasks: (clientId: string, period: string) =>
    apiRequest<any[]>(`/commercial/attachments/facturable-tasks?clientId=${clientId}&period=${period}`),
  create: (data: Record<string, unknown>) =>
    apiRequest<any>('/commercial/attachments', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    apiRequest(`/commercial/attachments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const quotesApi = {
  list: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]).toString();
    return apiRequest<any>(`/commercial/quotes?${qs}`);
  },
  getOne: (id: string) => apiRequest<any>(`/commercial/quotes/${id}`),
  create: (data: Record<string, unknown>) =>
    apiRequest<any>('/commercial/quotes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/commercial/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest(`/commercial/quotes/${id}`, { method: 'DELETE' }),
};

export const invoicesApi = {
  list: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]).toString();
    return apiRequest<any>(`/commercial/invoices?${qs}`);
  },
  getOne: (id: string) => apiRequest<any>(`/commercial/invoices/${id}`),
  create: (data: Record<string, unknown>) =>
    apiRequest<any>('/commercial/invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/commercial/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  recordPayment: (id: string, amount: number) =>
    apiRequest(`/commercial/invoices/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ amount }) }),
  delete: (id: string) => apiRequest(`/commercial/invoices/${id}`, { method: 'DELETE' }),
};
```

### Step 2: `/commercial/attachments` page

**File:** `apps/web/src/app/(app)/commercial/attachments/page.tsx`

```tsx
import { Header } from '@/components/layout/header';
import { AttachmentsView } from './attachments-view';

export const metadata = { title: 'Bordereaux' };

export default function AttachmentsPage() {
  return (
    <>
      <Header title="Bordereaux d'attachement" />
      <div className="p-6 space-y-6"><AttachmentsView /></div>
    </>
  );
}
```

**File:** `apps/web/src/app/(app)/commercial/attachments/attachments-view.tsx`

Implement with:
- StatsBar: Total bordereaux | Montant en attente | Générés | Envoyés
- DataTable with columns: Référence | Client | Projet | Période | Montant HT | Statut | Nb lignes
- "Générer un bordereau" button → opens `GenerateAttachmentDialog` (picks client, period, shows facturable tasks as checkboxes)
- Actions: Voir détail | Télécharger PDF | Changer statut

```bash
git add apps/web/src/app/(app)/commercial/attachments/
git commit -m "feat(web): add /commercial/attachments page"
```

### Step 3: `/commercial/quotes` page

**File:** `apps/web/src/app/(app)/commercial/quotes/page.tsx`
**File:** `apps/web/src/app/(app)/commercial/quotes/quotes-view.tsx`

Implement with:
- StatsBar: Total devis | Acceptés | En attente | Montant total
- DataTable: Référence | Client | Projet | Date | Validité | Montant HT | Montant TTC | Statut
- Form dialog for creating/editing (dynamic lines editor: add/remove lines with description, qty, unit price, VAT rate)
- "Télécharger PDF" button on each row → uses `<PDFDownloadLink>` from @react-pdf/renderer with `<QuotePDF />`

```bash
git add apps/web/src/app/(app)/commercial/quotes/
git commit -m "feat(web): add /commercial/quotes page with PDF download"
```

### Step 4: `/commercial/invoices` page

**File:** `apps/web/src/app/(app)/commercial/invoices/page.tsx`
**File:** `apps/web/src/app/(app)/commercial/invoices/invoices-view.tsx`

Implement with:
- StatsBar: Total factures | Payées | En attente | En retard
- DataTable: Référence | Client | Date | Échéance | HT | TTC | Payé | Reste dû | Statut
- "Enregistrer paiement" action → opens quick dialog to enter amount paid
- "Télécharger PDF" → uses `<InvoicePDF />`
- Badge color: vert=payé, orange=en attente, rouge=retard

```bash
git add apps/web/src/app/(app)/commercial/invoices/
git commit -m "feat(web): add /commercial/invoices page with payment recording and PDF"
```

---

## Task 9: Add navigation links

In `apps/web/src/components/layout/sidebar.tsx`, add a "Commercial" section:
- "Bordereaux" → `/commercial/attachments` with `FileText` icon
- "Devis" → `/commercial/quotes` with `FileCheck` icon
- "Factures" → `/commercial/invoices` with `Receipt` icon

```bash
git add apps/web/src/components/layout/
git commit -m "feat(web): add commercial navigation links"
```

---

## Task 10: Verification

```bash
pnpm --filter api tsc --noEmit
pnpm --filter web tsc --noEmit
pnpm build

# API checks
# POST /commercial/attachments with non-facturable taskIds → 400
# POST /commercial/attachments → creates with computed totalHt
# POST /commercial/quotes → creates with computed totals
# PATCH /commercial/invoices/:id/payment → updates amountPaid and status
# GET /commercial/attachments/facturable-tasks?clientId=X&period=2024-01 → filtered tasks

# Web pages
# /commercial/attachments → StatsBar, table, generate dialog
# /commercial/quotes → table, form with dynamic lines, PDF download button
# /commercial/invoices → table, payment dialog, PDF download, status badges
```

---

## Task 11: Final commit + push

```bash
git push -u origin feat/commercial
```

# ExeTeam Sprint 4B — Import Excel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a full Excel import pipeline — NestJS API (BullMQ processor, ExcelJS parsing, Supabase Storage upload, duplicate detection, fuzzy employee matching) + Next.js multi-step ImportWizard UI (drag-and-drop, column mapping, template save/load, real-time progress polling, error CSV download).

**Architecture:** NestJS `ImportModule` exposes REST endpoints for file upload, header parsing, job management, and template CRUD. BullMQ drives async row processing with per-row Zod validation. Next.js ImportWizard polls job progress via TanStack Query. The existing `ImportLog` and `ImportTemplate` Prisma models are extended/migrated to match the new requirements.

**Tech Stack:** NestJS · Prisma · Zod pipes · BullMQ · ExcelJS · Supabase Storage · TanStack Query · shadcn/ui · react-hook-form + zod · react-dropzone

**Prerequisite:** Sprint 2A (clients), Sprint 2B (sites), Sprint 2D (employees), Sprint 3A (projects/tasks) complete.

---

## Task 1: Create branch `feat/import`

```bash
git checkout main && git pull origin main
git checkout -b feat/import
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/import branch"
```

---

## Task 2: Install dependencies

```bash
# In apps/api
cd apps/api && pnpm add @nestjs/bull bullmq bull exceljs multer @supabase/storage-js fast-levenshtein
cd apps/api && pnpm add -D @types/multer @types/bull @types/fast-levenshtein

# In apps/web
cd apps/web && pnpm add react-dropzone exceljs
cd apps/web && pnpm add -D @types/react-dropzone
```

**Commit:**
```bash
git add apps/api/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add BullMQ, ExcelJS, Multer, react-dropzone dependencies"
```

---

## Task 3: Prisma migration — extend ImportLog and ImportTemplate

The existing `ImportLog` and `ImportTemplate` models in the schema need additional fields to support per-entity-type imports, file URLs, row-level progress tracking, and structured error storage. Run a migration to add the missing columns.

**File to edit:** `packages/db/prisma/schema.prisma`

Replace the existing `ImportTemplate` and `ImportLog` models with the following:

```prisma
model ImportTemplate {
  id         String   @id @default(uuid())
  name       String
  entityType String   // clients | employees | sites | tasks | purchase-invoices
  mappings   Json     @db.JsonB // Record<excelColumn, dbField>
  createdById String?
  createdBy  User?    @relation("ImportTemplateCreator", fields: [createdById], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  importJobs ImportJob[]

  @@map("import_templates")
}

model ImportJob {
  id            String    @id @default(uuid())
  entityType    String    // clients | employees | sites | tasks | purchase-invoices
  status        String    @default("pending") // pending | processing | done | failed
  totalRows     Int       @default(0)
  processedRows Int       @default(0)
  errorRows     Int       @default(0)
  errors        Json?     @db.JsonB // [{row: number, field: string, message: string}]
  fileUrl       String
  fileName      String
  mappings      Json      @db.JsonB // Record<excelColumn, dbField>
  onDuplicate   String    @default("skip") // skip | update
  templateId    String?
  template      ImportTemplate? @relation(fields: [templateId], references: [id])
  createdById   String
  createdBy     User      @relation("ImportJobCreator", fields: [createdById], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  completedAt   DateTime?

  @@map("import_jobs")
}
```

Also add the reverse relations on the `User` model:

```prisma
// Inside model User { ... }
importJobs     ImportJob[]     @relation("ImportJobCreator")
importTemplates ImportTemplate[] @relation("ImportTemplateCreator")
```

Then generate and run the migration:

```bash
cd packages/db
npx prisma migrate dev --name extend_import_models
npx prisma generate
```

**Commit:**
```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(db): extend ImportJob and ImportTemplate models for Excel import pipeline"
```

---

## Task 4: Shared types (`packages/shared/src/import.ts`)

**File to create:** `packages/shared/src/import.ts`

```typescript
export enum ImportEntityType {
  Clients = 'clients',
  Employees = 'employees',
  Sites = 'sites',
  Tasks = 'tasks',
  PurchaseInvoices = 'purchase-invoices',
}

export enum ImportJobStatus {
  Pending = 'pending',
  Processing = 'processing',
  Done = 'done',
  Failed = 'failed',
}

export enum OnDuplicateAction {
  Skip = 'skip',
  Update = 'update',
}

export interface ColumnMapping {
  excelColumn: string;
  dbField: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportJobSummary {
  id: string;
  entityType: ImportEntityType;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: ImportError[] | null;
  fileUrl: string;
  fileName: string;
  mappings: Record<string, string>;
  onDuplicate: OnDuplicateAction;
  templateId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ImportTemplateSummary {
  id: string;
  name: string;
  entityType: ImportEntityType;
  mappings: Record<string, string>;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Required DB fields per entity type (used for validation UI). */
export const REQUIRED_FIELDS: Record<ImportEntityType, string[]> = {
  [ImportEntityType.Clients]: ['name'],
  [ImportEntityType.Employees]: ['firstName', 'lastName', 'email'],
  [ImportEntityType.Sites]: ['name', 'clientId', 'address'],
  [ImportEntityType.Tasks]: ['title', 'projectId'],
  [ImportEntityType.PurchaseInvoices]: ['reference', 'supplierId', 'amount', 'date'],
};

/** Available DB fields per entity type for mapping dropdowns. */
export const AVAILABLE_FIELDS: Record<ImportEntityType, { value: string; label: string }[]> = {
  [ImportEntityType.Clients]: [
    { value: 'name', label: 'Nom *' },
    { value: 'legalName', label: 'Raison sociale' },
    { value: 'siret', label: 'SIRET' },
    { value: 'vatNumber', label: 'N° TVA' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Téléphone' },
    { value: 'addressLine1', label: 'Adresse' },
    { value: 'postalCode', label: 'Code postal' },
    { value: 'city', label: 'Ville' },
    { value: 'country', label: 'Pays' },
    { value: 'paymentConditions', label: 'Conditions de paiement' },
    { value: 'notes', label: 'Notes' },
  ],
  [ImportEntityType.Employees]: [
    { value: 'firstName', label: 'Prénom *' },
    { value: 'lastName', label: 'Nom *' },
    { value: 'professionalEmail', label: 'Email professionnel *' },
    { value: 'personalEmail', label: 'Email personnel' },
    { value: 'phone', label: 'Téléphone' },
    { value: 'position', label: 'Poste' },
    { value: 'contractType', label: 'Type de contrat' },
    { value: 'entryDate', label: "Date d'entrée" },
    { value: 'weeklyHours', label: 'Heures hebdomadaires' },
    { value: 'grossSalary', label: 'Salaire brut' },
    { value: 'netSalary', label: 'Salaire net' },
    { value: 'addressLine1', label: 'Adresse' },
    { value: 'postalCode', label: 'Code postal' },
    { value: 'city', label: 'Ville' },
  ],
  [ImportEntityType.Sites]: [
    { value: 'name', label: 'Nom *' },
    { value: 'clientId', label: 'Client (ID) *' },
    { value: 'address', label: 'Adresse *' },
    { value: 'postalCode', label: 'Code postal' },
    { value: 'commune', label: 'Commune' },
    { value: 'departement', label: 'Département' },
    { value: 'country', label: 'Pays' },
    { value: 'latitude', label: 'Latitude' },
    { value: 'longitude', label: 'Longitude' },
  ],
  [ImportEntityType.Tasks]: [
    { value: 'title', label: 'Titre *' },
    { value: 'projectId', label: 'Projet (ID) *' },
    { value: 'description', label: 'Description' },
    { value: 'status', label: 'Statut' },
    { value: 'priority', label: 'Priorité' },
    { value: 'employeeId', label: 'Employé assigné (ID)' },
    { value: 'plannedStartDate', label: 'Date début prévue' },
    { value: 'plannedEndDate', label: 'Date fin prévue' },
    { value: 'estimatedHours', label: 'Heures estimées' },
  ],
  [ImportEntityType.PurchaseInvoices]: [
    { value: 'reference', label: 'Référence *' },
    { value: 'supplierId', label: 'Fournisseur (ID) *' },
    { value: 'amount', label: 'Montant HT *' },
    { value: 'date', label: 'Date *' },
    { value: 'vatRate', label: 'Taux TVA' },
    { value: 'dueDate', label: "Date d'échéance" },
    { value: 'notes', label: 'Notes' },
  ],
};

/** Headers for downloadable Excel templates per entity type. */
export const TEMPLATE_HEADERS: Record<ImportEntityType, string[]> = {
  [ImportEntityType.Clients]: [
    'Nom', 'Raison sociale', 'SIRET', 'N° TVA', 'Email', 'Téléphone',
    'Adresse', 'Code postal', 'Ville', 'Pays', 'Conditions de paiement', 'Notes',
  ],
  [ImportEntityType.Employees]: [
    'Prénom', 'Nom', 'Email professionnel', 'Email personnel', 'Téléphone',
    'Poste', 'Type de contrat', "Date d'entrée", 'Heures hebdomadaires',
    'Salaire brut', 'Salaire net', 'Adresse', 'Code postal', 'Ville',
  ],
  [ImportEntityType.Sites]: [
    'Nom', 'Client (ID)', 'Adresse', 'Code postal', 'Commune', 'Département', 'Pays', 'Latitude', 'Longitude',
  ],
  [ImportEntityType.Tasks]: [
    'Titre', 'Projet (ID)', 'Description', 'Statut', 'Priorité',
    'Employé assigné (ID)', 'Date début prévue', 'Date fin prévue', 'Heures estimées',
  ],
  [ImportEntityType.PurchaseInvoices]: [
    'Référence', 'Fournisseur (ID)', 'Montant HT', 'Date', 'Taux TVA', "Date d'échéance", 'Notes',
  ],
};
```

**File to edit:** `packages/shared/src/index.ts`

Add the export:

```typescript
export * from './import';
```

**Commit:**
```bash
git add packages/shared/src/import.ts packages/shared/src/index.ts
git commit -m "feat(shared): add import types, enums, and field definitions"
```

---

## Task 5: NestJS — DTOs

**Files to create:**
- `apps/api/src/import/dto/start-import.dto.ts`
- `apps/api/src/import/dto/save-template.dto.ts`
- `apps/api/src/import/dto/list-imports.dto.ts`

### `apps/api/src/import/dto/start-import.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StartImportSchema = z.object({
  entityType: z.enum(['clients', 'employees', 'sites', 'tasks', 'purchase-invoices']),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  mappings: z.record(z.string(), z.string()),
  onDuplicate: z.enum(['skip', 'update']).default('skip'),
  templateId: z.string().uuid().optional(),
});

export class StartImportDto extends createZodDto(StartImportSchema) {}
```

### `apps/api/src/import/dto/save-template.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SaveTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  entityType: z.enum(['clients', 'employees', 'sites', 'tasks', 'purchase-invoices']),
  mappings: z.record(z.string(), z.string()),
});

export class SaveTemplateDto extends createZodDto(SaveTemplateSchema) {}
```

### `apps/api/src/import/dto/list-imports.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListImportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z
    .enum(['clients', 'employees', 'sites', 'tasks', 'purchase-invoices'])
    .optional(),
  status: z.enum(['pending', 'processing', 'done', 'failed']).optional(),
});

export class ListImportsDto extends createZodDto(ListImportsSchema) {}
```

**Commit:**
```bash
git add apps/api/src/import/dto/
git commit -m "feat(api): add import DTOs (StartImport, SaveTemplate, ListImports)"
```

---

## Task 6: NestJS — Levenshtein helper and row validators

**File to create:** `apps/api/src/import/helpers/levenshtein.ts`

```typescript
/**
 * Compute the Levenshtein distance between two strings.
 * Used for fuzzy-matching employee names during import.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/** Return true when two names are close enough to be considered the same person. */
export function isFuzzyMatch(a: string, b: string, threshold = 3): boolean {
  return levenshtein(a.toLowerCase().trim(), b.toLowerCase().trim()) <= threshold;
}
```

**File to create:** `apps/api/src/import/helpers/row-validators.ts`

```typescript
import { z } from 'zod';

/** Zod schemas used to validate each mapped row before upserting. */

export const ClientRowSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  legalName: z.string().optional(),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  paymentConditions: z.string().optional(),
  notes: z.string().optional(),
});

export const EmployeeRowSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  professionalEmail: z.string().email('Email professionnel invalide'),
  personalEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().optional(),
  contractType: z.string().optional(),
  entryDate: z.coerce.date().optional(),
  weeklyHours: z.coerce.number().nonnegative().optional(),
  grossSalary: z.coerce.number().nonnegative().optional(),
  netSalary: z.coerce.number().nonnegative().optional(),
  addressLine1: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
});

export const SiteRowSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  clientId: z.string().min(1, 'Client requis'),
  address: z.string().min(1, 'Adresse requise'),
  postalCode: z.string().optional(),
  commune: z.string().optional(),
  departement: z.string().optional(),
  country: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const TaskRowSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  projectId: z.string().min(1, 'Projet requis'),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  employeeId: z.string().optional(),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  estimatedHours: z.coerce.number().nonnegative().optional(),
});

export const PurchaseInvoiceRowSchema = z.object({
  reference: z.string().min(1, 'Référence requise'),
  supplierId: z.string().min(1, 'Fournisseur requis'),
  amount: z.coerce.number({ required_error: 'Montant requis' }),
  date: z.coerce.date({ required_error: 'Date requise' }),
  vatRate: z.coerce.number().nonnegative().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export type EntityType = 'clients' | 'employees' | 'sites' | 'tasks' | 'purchase-invoices';

export function getRowSchema(entityType: EntityType) {
  switch (entityType) {
    case 'clients':
      return ClientRowSchema;
    case 'employees':
      return EmployeeRowSchema;
    case 'sites':
      return SiteRowSchema;
    case 'tasks':
      return TaskRowSchema;
    case 'purchase-invoices':
      return PurchaseInvoiceRowSchema;
  }
}
```

**Commit:**
```bash
git add apps/api/src/import/helpers/
git commit -m "feat(api): add Levenshtein helper and per-entity row Zod validators"
```

---

## Task 7: NestJS — ImportService

**File to create:** `apps/api/src/import/import.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { StartImportDto } from './dto/start-import.dto';
import { SaveTemplateDto } from './dto/save-template.dto';
import { ListImportsDto } from './dto/list-imports.dto';

@Injectable()
export class ImportService {
  private readonly supabase;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('import') private readonly importQueue: Queue,
  ) {
    this.supabase = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  // ────────────────────────────────────────────────────────────
  // File handling
  // ────────────────────────────────────────────────────────────

  async uploadFile(file: Express.Multer.File): Promise<{ fileUrl: string; fileName: string }> {
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Fichier trop volumineux (max 10 MB)');
    }
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Seuls les fichiers .xlsx et .xls sont acceptés');
    }

    const ext = file.originalname.split('.').pop() ?? 'xlsx';
    const path = `imports/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await this.supabase.storage
      .from('imports')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (error) throw new BadRequestException(`Erreur upload: ${error.message}`);

    const { data } = this.supabase.storage.from('imports').getPublicUrl(path);
    return { fileUrl: data.publicUrl, fileName: file.originalname };
  }

  async parseHeaders(fileUrl: string): Promise<string[]> {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new BadRequestException('Impossible de télécharger le fichier');
    const buffer = Buffer.from(await response.arrayBuffer());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Le fichier Excel est vide');

    const firstRow = sheet.getRow(1);
    const headers: string[] = [];
    firstRow.eachCell((cell) => {
      const val = cell.value?.toString().trim();
      if (val) headers.push(val);
    });
    return headers;
  }

  // ────────────────────────────────────────────────────────────
  // Jobs
  // ────────────────────────────────────────────────────────────

  async startImport(dto: StartImportDto, userId: string) {
    const job = await this.prisma.importJob.create({
      data: {
        entityType: dto.entityType,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mappings: dto.mappings,
        onDuplicate: dto.onDuplicate,
        templateId: dto.templateId ?? null,
        createdById: userId,
        status: 'pending',
      },
    });

    await this.importQueue.add(
      'process',
      { jobId: job.id },
      { attempts: 2, backoff: { type: 'exponential', delay: 3000 } },
    );

    return { jobId: job.id };
  }

  async getJob(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: { template: { select: { id: true, name: true } } },
    });
    if (!job) throw new NotFoundException(`ImportJob ${id} not found`);
    return job;
  }

  async listJobs(dto: ListImportsDto) {
    const { page, limit, entityType, status } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (entityType) where['entityType'] = entityType;
    if (status) where['status'] = status;

    const [data, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { template: { select: { id: true, name: true } } },
      }),
      this.prisma.importJob.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ────────────────────────────────────────────────────────────
  // Templates
  // ────────────────────────────────────────────────────────────

  async saveTemplate(dto: SaveTemplateDto, userId: string) {
    return this.prisma.importTemplate.create({
      data: {
        name: dto.name,
        entityType: dto.entityType,
        mappings: dto.mappings,
        createdById: userId,
      },
    });
  }

  async listTemplates(entityType?: string) {
    return this.prisma.importTemplate.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(id: string) {
    const tpl = await this.prisma.importTemplate.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException(`ImportTemplate ${id} not found`);
    await this.prisma.importTemplate.delete({ where: { id } });
    return { success: true };
  }
}
```

**Commit:**
```bash
git add apps/api/src/import/import.service.ts
git commit -m "feat(api): add ImportService (upload, parse headers, job management, templates)"
```

---

## Task 8: NestJS — BullMQ ImportProcessor

**File to create:** `apps/api/src/import/import.processor.ts`

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { getRowSchema, EntityType } from './helpers/row-validators';
import { isFuzzyMatch } from './helpers/levenshtein';
import type { ImportError } from '@exeteam/shared';

interface ImportJobData {
  jobId: string;
}

@Processor('import')
export class ImportProcessor {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('process')
  async handleImport(bullJob: Job<ImportJobData>) {
    const { jobId } = bullJob.data;
    this.logger.log(`Processing import job ${jobId}`);

    // Fetch job record
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) {
      this.logger.error(`ImportJob ${jobId} not found`);
      return;
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    try {
      // Download file
      const response = await fetch(job.fileUrl);
      if (!response.ok) throw new Error(`Cannot download file: ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Parse workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('Empty workbook');

      // Read headers from row 1
      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell) => headers.push(cell.value?.toString().trim() ?? ''));

      // Gather data rows (rows 2..N)
      const dataRows: Record<string, unknown>[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj: Record<string, unknown> = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) obj[header] = cell.value ?? null;
        });
        dataRows.push(obj);
      });

      const totalRows = dataRows.length;
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { totalRows },
      });

      const mappings = job.mappings as Record<string, string>;
      const onDuplicate = job.onDuplicate as 'skip' | 'update';
      const entityType = job.entityType as EntityType;
      const schema = getRowSchema(entityType);

      const errors: ImportError[] = [];
      let processedRows = 0;
      let errorRows = 0;

      // Pre-load data needed for fuzzy/duplicate checks
      const allEmployees =
        entityType === 'employees'
          ? await this.prisma.employee.findMany({
              select: { id: true, firstName: true, lastName: true, professionalEmail: true },
            })
          : [];

      for (let i = 0; i < dataRows.length; i++) {
        const excelRow = dataRows[i];
        const rowNumber = i + 2; // Excel row number (1=header)

        // Map columns to DB fields
        const mapped: Record<string, unknown> = {};
        for (const [excelCol, dbField] of Object.entries(mappings)) {
          mapped[dbField] = excelRow[excelCol] ?? null;
        }

        // Validate with Zod
        const parsed = schema.safeParse(mapped);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            errors.push({
              row: rowNumber,
              field: issue.path.join('.'),
              message: issue.message,
            });
          }
          errorRows++;
          processedRows++;
          continue;
        }

        const data = parsed.data;

        try {
          await this.upsertRow(entityType, data as Record<string, unknown>, onDuplicate, allEmployees);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ row: rowNumber, field: '', message: msg });
          errorRows++;
        }

        processedRows++;

        // Persist progress every 50 rows
        if (processedRows % 50 === 0) {
          await this.prisma.importJob.update({
            where: { id: jobId },
            data: { processedRows, errorRows, errors },
          });
        }
      }

      // Final update
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          processedRows,
          errorRows,
          totalRows,
          errors,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Job ${jobId} done: ${processedRows} rows, ${errorRows} errors`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${jobId} failed: ${msg}`);
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errors: [{ row: 0, field: '', message: msg }],
          completedAt: new Date(),
        },
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // Per-entity upsert logic
  // ────────────────────────────────────────────────────────────

  private async upsertRow(
    entityType: EntityType,
    data: Record<string, unknown>,
    onDuplicate: 'skip' | 'update',
    allEmployees: { id: string; firstName: string; lastName: string; professionalEmail: string | null }[],
  ): Promise<void> {
    switch (entityType) {
      case 'clients':
        return this.upsertClient(data, onDuplicate);
      case 'employees':
        return this.upsertEmployee(data, onDuplicate, allEmployees);
      case 'sites':
        return this.upsertSite(data, onDuplicate);
      case 'tasks':
        return this.upsertTask(data, onDuplicate);
      case 'purchase-invoices':
        return this.upsertPurchaseInvoice(data, onDuplicate);
    }
  }

  private async upsertClient(data: Record<string, unknown>, onDuplicate: 'skip' | 'update') {
    const siret = data['siret'] as string | undefined;
    const existing = siret
      ? await this.prisma.client.findFirst({ where: { siret } })
      : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.client.update({ where: { id: existing.id }, data });
      }
      return;
    }
    await this.prisma.client.create({ data: data as Parameters<typeof this.prisma.client.create>[0]['data'] });
  }

  private async upsertEmployee(
    data: Record<string, unknown>,
    onDuplicate: 'skip' | 'update',
    allEmployees: { id: string; firstName: string; lastName: string; professionalEmail: string | null }[],
  ) {
    const email = (data['professionalEmail'] as string | undefined)?.toLowerCase();

    // Exact duplicate check by email
    const existing = email
      ? await this.prisma.employee.findFirst({ where: { professionalEmail: email } })
      : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.employee.update({ where: { id: existing.id }, data });
      }
      return;
    }

    // Fuzzy match by full name to warn/skip accidental near-duplicates
    const fullName = `${data['firstName'] ?? ''} ${data['lastName'] ?? ''}`.trim();
    const fuzzyMatch = allEmployees.find((e) =>
      isFuzzyMatch(`${e.firstName} ${e.lastName}`, fullName),
    );
    if (fuzzyMatch && onDuplicate === 'skip') {
      throw new Error(
        `Doublon potentiel (nom similaire): "${fuzzyMatch.firstName} ${fuzzyMatch.lastName}"`,
      );
    }

    await this.prisma.employee.create({ data: data as Parameters<typeof this.prisma.employee.create>[0]['data'] });
  }

  private async upsertSite(data: Record<string, unknown>, onDuplicate: 'skip' | 'update') {
    const address = data['address'] as string | undefined;
    const clientId = data['clientId'] as string | undefined;

    const existing =
      address && clientId
        ? await this.prisma.site.findFirst({ where: { address, clientId } })
        : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.site.update({ where: { id: existing.id }, data });
      }
      return;
    }

    // Generate reference
    const count = await this.prisma.site.count();
    const reference = `SITE-${String(count + 1).padStart(5, '0')}`;
    await this.prisma.site.create({
      data: { ...(data as Parameters<typeof this.prisma.site.create>[0]['data']), reference },
    });
  }

  private async upsertTask(data: Record<string, unknown>, onDuplicate: 'skip' | 'update') {
    const title = data['title'] as string | undefined;
    const projectId = data['projectId'] as string | undefined;

    const existing =
      title && projectId
        ? await this.prisma.task.findFirst({ where: { title, projectId } })
        : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.task.update({ where: { id: existing.id }, data });
      }
      return;
    }

    const count = await this.prisma.task.count();
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const reference = `TASK-${yyyymm}-${String(count + 1).padStart(5, '0')}`;

    await this.prisma.task.create({
      data: { ...(data as Parameters<typeof this.prisma.task.create>[0]['data']), reference },
    });
  }

  private async upsertPurchaseInvoice(data: Record<string, unknown>, onDuplicate: 'skip' | 'update') {
    const reference = data['reference'] as string | undefined;
    const existing = reference
      ? await this.prisma.purchaseInvoice.findFirst({ where: { reference } })
      : null;

    if (existing) {
      if (onDuplicate === 'update') {
        await this.prisma.purchaseInvoice.update({ where: { id: existing.id }, data });
      }
      return;
    }
    await this.prisma.purchaseInvoice.create({
      data: data as Parameters<typeof this.prisma.purchaseInvoice.create>[0]['data'],
    });
  }
}
```

**Commit:**
```bash
git add apps/api/src/import/import.processor.ts
git commit -m "feat(api): add BullMQ ImportProcessor with per-entity upsert and fuzzy matching"
```

---

## Task 9: NestJS — ImportController

**File to create:** `apps/api/src/import/import.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { StartImportDto } from './dto/start-import.dto';
import { SaveTemplateDto } from './dto/save-template.dto';
import { ListImportsDto } from './dto/list-imports.dto';

@UseGuards(JwtAuthGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  // ── File handling ───────────────────────────────────────────

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    const { fileUrl, fileName } = await this.importService.uploadFile(file);
    const headers = await this.importService.parseHeaders(fileUrl);
    return { fileUrl, fileName, headers };
  }

  @Post('parse-headers')
  async parseHeaders(@Body() body: { fileUrl: string }) {
    const headers = await this.importService.parseHeaders(body.fileUrl);
    return { headers };
  }

  // ── Jobs ────────────────────────────────────────────────────

  @Post('start')
  async start(@Body() dto: StartImportDto, @CurrentUser() user: { id: string }) {
    return this.importService.startImport(dto, user.id);
  }

  @Get('jobs')
  async listJobs(@Query() dto: ListImportsDto) {
    return this.importService.listJobs(dto);
  }

  @Get('jobs/:id')
  async getJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.importService.getJob(id);
  }

  // ── Templates ───────────────────────────────────────────────

  @Get('templates')
  async listTemplates(@Query('entityType') entityType?: string) {
    return this.importService.listTemplates(entityType);
  }

  @Post('templates')
  async saveTemplate(
    @Body() dto: SaveTemplateDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.importService.saveTemplate(dto, user.id);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.importService.deleteTemplate(id);
  }
}
```

**Commit:**
```bash
git add apps/api/src/import/import.controller.ts
git commit -m "feat(api): add ImportController with upload, job, and template endpoints"
```

---

## Task 10: NestJS — ImportModule and AppModule registration

**File to create:** `apps/api/src/import/import.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { ImportProcessor } from './import.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'import',
    }),
  ],
  providers: [ImportService, ImportProcessor],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}
```

**File to edit:** `apps/api/src/app.module.ts`

Add the BullModule global config and the ImportModule:

```typescript
import { BullModule } from '@nestjs/bull';
import { ImportModule } from './import/import.module';

// Inside @Module({ imports: [ ... ] }), add:
BullModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    redis: {
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      password: config.get('REDIS_PASSWORD'),
    },
  }),
  inject: [ConfigService],
}),
ImportModule,
```

The full updated `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { ClientsModule } from './clients/clients.module';
import { SitesModule } from './sites/sites.module';
import { EmployeesModule } from './employees/employees.module';
import { LeavesModule } from './leaves/leaves.module';
import { PublicHolidaysModule } from './public-holidays/public-holidays.module';
import { CodesProduitsModule } from './codes-produits/codes-produits.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { OperatorsModule } from './operators/operators.module';
import { InterlocuteursModule } from './interlocuteurs/interlocuteurs.module';
import { TagsModule } from './tags/tags.module';
import { DemandsModule } from './demands/demands.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushModule } from './push/push.module';
import { CommercialModule } from './commercial/commercial.module';
import { MessagingModule } from './messaging/messaging.module';
import { ImportModule } from './import/import.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    ClientsModule,
    SitesModule,
    EmployeesModule,
    LeavesModule,
    PublicHolidaysModule,
    CodesProduitsModule,
    CustomFieldsModule,
    OperatorsModule,
    InterlocuteursModule,
    TagsModule,
    DemandsModule,
    NotificationsModule,
    PushModule,
    CommercialModule,
    MessagingModule,
    ImportModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

Add Redis env vars to `.env.local`:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # set if using auth
```

**Commit:**
```bash
git add apps/api/src/import/import.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): register ImportModule and BullModule in AppModule"
```

---

## Task 11: Next.js — API helpers (`apps/web/src/lib/api/import.ts`)

**File to create:** `apps/web/src/lib/api/import.ts`

```typescript
import { ImportEntityType, ImportJobStatus } from '@exeteam/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'API error');
  }
  return res.json() as Promise<T>;
}

// ── File handling ─────────────────────────────────────────────

export interface UploadResult {
  fileUrl: string;
  fileName: string;
  headers: string[];
}

export async function uploadImportFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/import/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Upload failed');
  }
  return res.json() as Promise<UploadResult>;
}

export async function parseImportHeaders(fileUrl: string): Promise<string[]> {
  const result = await apiFetch<{ headers: string[] }>('/import/parse-headers', {
    method: 'POST',
    body: JSON.stringify({ fileUrl }),
  });
  return result.headers;
}

// ── Jobs ──────────────────────────────────────────────────────

export interface StartImportPayload {
  entityType: ImportEntityType;
  fileUrl: string;
  fileName: string;
  mappings: Record<string, string>;
  onDuplicate: 'skip' | 'update';
  templateId?: string;
}

export interface ImportJobDto {
  id: string;
  entityType: ImportEntityType;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: { row: number; field: string; message: string }[] | null;
  fileUrl: string;
  fileName: string;
  mappings: Record<string, string>;
  onDuplicate: string;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export async function startImport(payload: StartImportPayload): Promise<{ jobId: string }> {
  return apiFetch('/import/start', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getImportJob(id: string): Promise<ImportJobDto> {
  return apiFetch(`/import/jobs/${id}`);
}

export interface ListImportJobsParams {
  page?: number;
  limit?: number;
  entityType?: ImportEntityType;
  status?: ImportJobStatus;
}

export interface PaginatedJobs {
  data: ImportJobDto[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function listImportJobs(params: ListImportJobsParams = {}): Promise<PaginatedJobs> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.entityType) qs.set('entityType', params.entityType);
  if (params.status) qs.set('status', params.status);
  return apiFetch(`/import/jobs?${qs.toString()}`);
}

// ── Templates ─────────────────────────────────────────────────

export interface ImportTemplateDto {
  id: string;
  name: string;
  entityType: ImportEntityType;
  mappings: Record<string, string>;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listImportTemplates(entityType?: ImportEntityType): Promise<ImportTemplateDto[]> {
  const qs = entityType ? `?entityType=${entityType}` : '';
  return apiFetch(`/import/templates${qs}`);
}

export async function saveImportTemplate(payload: {
  name: string;
  entityType: ImportEntityType;
  mappings: Record<string, string>;
}): Promise<ImportTemplateDto> {
  return apiFetch('/import/templates', { method: 'POST', body: JSON.stringify(payload) });
}

export async function deleteImportTemplate(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/import/templates/${id}`, { method: 'DELETE' });
}
```

**Commit:**
```bash
git add apps/web/src/lib/api/import.ts
git commit -m "feat(web): add import API helper functions"
```

---

## Task 12: Next.js — Excel template download helper

**File to create:** `apps/web/src/lib/import-templates.ts`

```typescript
import * as ExcelJS from 'exceljs';
import { ImportEntityType, TEMPLATE_HEADERS } from '@exeteam/shared';

/**
 * Generate and trigger browser download of a minimal Excel template
 * with the correct column headers for the given entity type.
 */
export async function downloadImportTemplate(entityType: ImportEntityType): Promise<void> {
  const headers = TEMPLATE_HEADERS[entityType];
  if (!headers) throw new Error(`Unknown entity type: ${entityType}`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ExeTeam';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Import');

  // Add header row with bold styling
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF6600' },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Auto-width columns
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 4, 15),
  }));

  // Add one sample row with placeholder text
  const sampleData = headers.map(() => '');
  sheet.addRow(sampleData);

  // Write to buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `modele-import-${entityType}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

**Commit:**
```bash
git add apps/web/src/lib/import-templates.ts
git commit -m "feat(web): add downloadImportTemplate helper using ExcelJS"
```

---

## Task 13: Next.js — ImportWizard Step 1 — Choisir l'entité

**File to create:** `apps/web/src/components/import/steps/StepChooseEntity.tsx`

```tsx
'use client';

import { ImportEntityType } from '@exeteam/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadImportTemplate } from '@/lib/import-templates';

const ENTITY_OPTIONS: { value: ImportEntityType; label: string; description: string }[] = [
  { value: ImportEntityType.Clients, label: 'Clients', description: 'Importer des fiches client' },
  { value: ImportEntityType.Employees, label: 'Employés', description: 'Importer des fiches employé' },
  { value: ImportEntityType.Sites, label: 'Sites', description: 'Importer des sites client' },
  { value: ImportEntityType.Tasks, label: 'Tâches', description: 'Importer des tâches de projet' },
  {
    value: ImportEntityType.PurchaseInvoices,
    label: "Factures d'achat",
    description: "Importer des factures fournisseurs",
  },
];

interface Props {
  value: ImportEntityType | null;
  onChange: (v: ImportEntityType) => void;
  onNext: () => void;
}

export function StepChooseEntity({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choisir le type d'entité à importer</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sélectionnez le type de données que vous souhaitez importer.
        </p>
      </div>

      <RadioGroup
        value={value ?? ''}
        onValueChange={(v) => onChange(v as ImportEntityType)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {ENTITY_OPTIONS.map((opt) => (
          <Label key={opt.value} htmlFor={opt.value} className="cursor-pointer">
            <Card
              className={`transition-colors ${
                value === opt.value ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              }`}
            >
              <CardContent className="flex items-start gap-3 pt-4">
                <RadioGroupItem value={opt.value} id={opt.value} className="mt-0.5" />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </CardContent>
            </Card>
          </Label>
        ))}
      </RadioGroup>

      {value && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadImportTemplate(value)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Télécharger le modèle Excel pour « {ENTITY_OPTIONS.find((o) => o.value === value)?.label} »
        </Button>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!value}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/import/steps/StepChooseEntity.tsx
git commit -m "feat(web): add ImportWizard Step 1 — choose entity type"
```

---

## Task 14: Next.js — ImportWizard Step 2 — Charger le fichier

**File to create:** `apps/web/src/components/import/steps/StepUploadFile.tsx`

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImportEntityType } from '@exeteam/shared';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { uploadImportFile } from '@/lib/api/import';
import type { ImportTemplateDto } from '@/lib/api/import';

interface Props {
  entityType: ImportEntityType;
  templates: ImportTemplateDto[];
  onUploaded: (fileUrl: string, fileName: string, headers: string[]) => void;
  onTemplateSelected: (template: ImportTemplateDto) => void;
  onNext: () => void;
  onBack: () => void;
  fileUrl: string | null;
  fileName: string | null;
}

export function StepUploadFile({
  entityType,
  templates,
  onUploaded,
  onTemplateSelected,
  onNext,
  onBack,
  fileUrl,
  fileName,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const result = await uploadImportFile(file);
        onUploaded(result.fileUrl, result.fileName, result.headers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: uploading,
  });

  const relevantTemplates = templates.filter((t) => t.entityType === entityType);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Charger le fichier Excel</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Formats acceptés : .xlsx, .xls — Taille max : 10 MB
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        {isDragActive ? (
          <p className="text-primary font-medium">Déposez le fichier ici…</p>
        ) : (
          <>
            <p className="font-medium">Glissez-déposez votre fichier ici</p>
            <p className="text-sm text-muted-foreground mt-1">ou cliquez pour parcourir</p>
          </>
        )}
        {uploading && <p className="mt-3 text-sm text-muted-foreground">Chargement en cours…</p>}
      </div>

      {/* Uploaded file indicator */}
      {fileUrl && fileName && (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/30">
          <File className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{fileName}</span>
          <span className="text-xs text-green-600 ml-auto">Chargé</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Template selector */}
      {relevantTemplates.length > 0 && (
        <div className="space-y-2">
          <Label>Utiliser un modèle de mappage sauvegardé</Label>
          <Select
            onValueChange={(id) => {
              const tpl = relevantTemplates.find((t) => t.id === id);
              if (tpl) onTemplateSelected(tpl);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir un modèle…" />
            </SelectTrigger>
            <SelectContent>
              {relevantTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onNext} disabled={!fileUrl}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/import/steps/StepUploadFile.tsx
git commit -m "feat(web): add ImportWizard Step 2 — drag-and-drop file upload"
```

---

## Task 15: Next.js — ImportWizard Step 3 — Mapper les colonnes

**File to create:** `apps/web/src/components/import/steps/StepMapColumns.tsx`

```tsx
'use client';

import { useState } from 'react';
import { ImportEntityType, AVAILABLE_FIELDS, REQUIRED_FIELDS } from '@exeteam/shared';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Save, AlertCircle } from 'lucide-react';
import { saveImportTemplate } from '@/lib/api/import';

interface Props {
  entityType: ImportEntityType;
  excelHeaders: string[];
  mappings: Record<string, string>;
  onChange: (mappings: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepMapColumns({ entityType, excelHeaders, mappings, onChange, onNext, onBack }: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const availableFields = AVAILABLE_FIELDS[entityType] ?? [];
  const requiredFields = REQUIRED_FIELDS[entityType] ?? [];

  const mappedRequiredFields = requiredFields.filter((f) => Object.values(mappings).includes(f));
  const missingRequired = requiredFields.filter((f) => !Object.values(mappings).includes(f));
  const canProceed = missingRequired.length === 0;

  function setMapping(excelCol: string, dbField: string) {
    const next = { ...mappings };
    if (!dbField || dbField === '__ignore__') {
      delete next[excelCol];
    } else {
      // Remove previous mapping of this db field to avoid duplicates
      for (const [col, field] of Object.entries(next)) {
        if (field === dbField && col !== excelCol) delete next[col];
      }
      next[excelCol] = dbField;
    }
    onChange(next);
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveImportTemplate({ name: templateName, entityType, mappings });
      setSaveOpen(false);
      setTemplateName('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mapper les colonnes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Associez chaque colonne Excel à un champ de la base de données.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSaveOpen(true)}
          disabled={Object.keys(mappings).length === 0}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Sauvegarder comme modèle
        </Button>
      </div>

      {missingRequired.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Champs obligatoires non mappés :{' '}
            {missingRequired
              .map((f) => availableFields.find((a) => a.value === f)?.label ?? f)
              .join(', ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2 font-medium w-1/2">Colonne Excel</th>
              <th className="text-left px-4 py-2 font-medium w-1/2">Champ cible</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {excelHeaders.map((col) => {
              const mapped = mappings[col];
              const fieldDef = availableFields.find((f) => f.value === mapped);
              const isRequired = mapped ? requiredFields.includes(mapped) : false;
              return (
                <tr key={col} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{col}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={mapped ?? '__ignore__'}
                        onValueChange={(v) => setMapping(col, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Ignorer cette colonne" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">— Ignorer —</SelectItem>
                          {availableFields.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isRequired && (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          Requis
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Suivant
        </Button>
      </div>

      {/* Save template dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sauvegarder le modèle de mappage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="template-name">Nom du modèle</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex: Import clients standard"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
            />
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || saving}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/import/steps/StepMapColumns.tsx
git commit -m "feat(web): add ImportWizard Step 3 — column mapping with template save"
```

---

## Task 16: Next.js — ImportWizard Steps 4 & 5

**File to create:** `apps/web/src/components/import/steps/StepConfirm.tsx`

```tsx
'use client';

import { ImportEntityType, AVAILABLE_FIELDS } from '@exeteam/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  entityType: ImportEntityType;
  fileName: string;
  mappings: Record<string, string>;
  onDuplicate: 'skip' | 'update';
  onDuplicateChange: (v: 'skip' | 'update') => void;
  previewRows: Record<string, unknown>[];
  onStart: () => void;
  onBack: () => void;
  isStarting: boolean;
}

export function StepConfirm({
  entityType,
  fileName,
  mappings,
  onDuplicate,
  onDuplicateChange,
  previewRows,
  onStart,
  onBack,
  isStarting,
}: Props) {
  const availableFields = AVAILABLE_FIELDS[entityType] ?? [];
  const mappingEntries = Object.entries(mappings);

  // Preview: apply mappings to first 5 rows
  const previewMapped = previewRows.slice(0, 5).map((row) => {
    const obj: Record<string, unknown> = {};
    for (const [excelCol, dbField] of mappingEntries) {
      obj[dbField] = row[excelCol] ?? '';
    }
    return obj;
  });

  const previewFields = mappingEntries.map(([, dbField]) => dbField);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Options & Confirmation</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vérifiez le résumé avant de lancer l'import.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-32">Fichier</span>
            <span className="font-medium truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-32">Type</span>
            <Badge variant="secondary">{entityType}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-32">Mappages</span>
            <span>{mappingEntries.length} colonnes configurées</span>
          </div>
        </CardContent>
      </Card>

      {/* Duplicate strategy */}
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="font-medium text-sm">Mettre à jour les doublons</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {onDuplicate === 'update'
              ? 'Les enregistrements existants seront mis à jour'
              : 'Les doublons seront ignorés (comportement par défaut)'}
          </p>
        </div>
        <Switch
          checked={onDuplicate === 'update'}
          onCheckedChange={(v) => onDuplicateChange(v ? 'update' : 'skip')}
        />
      </div>

      {/* Preview table */}
      {previewMapped.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Aperçu des 5 premières lignes</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="text-xs w-full">
              <thead className="bg-muted">
                <tr>
                  {previewFields.map((f) => (
                    <th key={f} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      {availableFields.find((a) => a.value === f)?.label ?? f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewMapped.map((row, i) => (
                  <tr key={i}>
                    {previewFields.map((f) => (
                      <td key={f} className="px-3 py-2 max-w-[200px] truncate">
                        {String(row[f] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onStart} disabled={isStarting}>
          {isStarting ? 'Démarrage…' : "Lancer l'import"}
        </Button>
      </div>
    </div>
  );
}
```

**File to create:** `apps/web/src/components/import/steps/StepProgress.tsx`

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { ImportJobStatus } from '@exeteam/shared';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Download } from 'lucide-react';
import { getImportJob } from '@/lib/api/import';

interface Props {
  jobId: string;
  onReset: () => void;
}

function statusBadgeVariant(status: ImportJobStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case ImportJobStatus.Done:
      return 'default';
    case ImportJobStatus.Failed:
      return 'destructive';
    case ImportJobStatus.Processing:
      return 'secondary';
    default:
      return 'outline';
  }
}

function downloadErrorCsv(errors: { row: number; field: string; message: string }[], fileName: string) {
  const lines = ['Ligne,Champ,Message', ...errors.map((e) => `${e.row},${e.field},"${e.message}"`)];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `erreurs-import-${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function StepProgress({ jobId, onReset }: Props) {
  const { data: job } = useQuery({
    queryKey: ['importJob', jobId],
    queryFn: () => getImportJob(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === ImportJobStatus.Processing || status === ImportJobStatus.Pending
        ? 2000
        : false;
    },
  });

  if (!job) {
    return (
      <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Chargement…</span>
      </div>
    );
  }

  const progress =
    job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
  const isDone = job.status === ImportJobStatus.Done;
  const isFailed = job.status === ImportJobStatus.Failed;
  const isProcessing =
    job.status === ImportJobStatus.Processing || job.status === ImportJobStatus.Pending;
  const errors = job.errors ?? [];
  const visibleErrors = errors.slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Import en cours</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez la progression de votre import.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        {isDone && <CheckCircle2 className="h-5 w-5 text-green-600" />}
        {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        <Badge variant={statusBadgeVariant(job.status as ImportJobStatus)}>
          {job.status === 'pending' && 'En attente'}
          {job.status === 'processing' && 'En cours…'}
          {job.status === 'done' && 'Terminé'}
          {job.status === 'failed' && 'Échec'}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{job.processedRows} / {job.totalRows} lignes traitées</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      {/* Summary on completion */}
      {isDone && (
        <Alert className="border-green-500 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Import terminé : {job.processedRows - job.errorRows} réussis, {job.errorRows} erreur
            {job.errorRows !== 1 ? 's' : ''}
          </AlertDescription>
        </Alert>
      )}

      {isFailed && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            L'import a échoué. Vérifiez les erreurs ci-dessous.
          </AlertDescription>
        </Alert>
      )}

      {/* Error log */}
      {visibleErrors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-destructive">
              Erreurs ({errors.length})
              {errors.length > 20 && ' — affichage des 20 premières'}
            </p>
            {isDone && errors.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadErrorCsv(errors, job.fileName)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Télécharger les erreurs (CSV)
              </Button>
            )}
          </div>
          <div className="rounded-md border overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-16">Ligne</th>
                  <th className="px-3 py-2 text-left font-medium w-28">Champ</th>
                  <th className="px-3 py-2 text-left font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleErrors.map((e, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-muted-foreground">{e.row}</td>
                    <td className="px-3 py-1.5 font-mono">{e.field || '—'}</td>
                    <td className="px-3 py-1.5 text-destructive">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(isDone || isFailed) && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onReset}>
            Nouvel import
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/import/steps/StepConfirm.tsx apps/web/src/components/import/steps/StepProgress.tsx
git commit -m "feat(web): add ImportWizard Steps 4 (confirm) and 5 (progress polling)"
```

---

## Task 17: Next.js — ImportWizard orchestrator

**File to create:** `apps/web/src/components/import/ImportWizard.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImportEntityType } from '@exeteam/shared';
import { Card, CardContent } from '@/components/ui/card';
import { StepChooseEntity } from './steps/StepChooseEntity';
import { StepUploadFile } from './steps/StepUploadFile';
import { StepMapColumns } from './steps/StepMapColumns';
import { StepConfirm } from './steps/StepConfirm';
import { StepProgress } from './steps/StepProgress';
import { listImportTemplates, startImport } from '@/lib/api/import';
import type { ImportTemplateDto } from '@/lib/api/import';

const STEPS = [
  "Choisir l'entité",
  'Charger le fichier',
  'Mapper les colonnes',
  'Confirmation',
  'Progression',
];

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Étapes" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEPS.map((label, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;
          return (
            <li key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`text-xs hidden sm:block ${
                    isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [entityType, setEntityType] = useState<ImportEntityType | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'update'>('skip');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { data: templates = [] } = useQuery<ImportTemplateDto[]>({
    queryKey: ['importTemplates', entityType],
    queryFn: () => listImportTemplates(entityType ?? undefined),
    enabled: !!entityType,
  });

  function handleUploaded(url: string, name: string, headers: string[]) {
    setFileUrl(url);
    setFileName(name);
    setExcelHeaders(headers);
    setMappings({});
  }

  function handleTemplateSelected(tpl: ImportTemplateDto) {
    setMappings(tpl.mappings as Record<string, string>);
  }

  async function handleStart() {
    if (!entityType || !fileUrl || !fileName) return;
    setIsStarting(true);
    try {
      const { jobId: id } = await startImport({
        entityType,
        fileUrl,
        fileName,
        mappings,
        onDuplicate,
      });
      setJobId(id);
      setStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStarting(false);
    }
  }

  function handleReset() {
    setStep(0);
    setEntityType(null);
    setFileUrl(null);
    setFileName(null);
    setExcelHeaders([]);
    setMappings({});
    setOnDuplicate('skip');
    setJobId(null);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <StepIndicator current={step} />

        {step === 0 && (
          <StepChooseEntity
            value={entityType}
            onChange={setEntityType}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && entityType && (
          <StepUploadFile
            entityType={entityType}
            templates={templates}
            onUploaded={handleUploaded}
            onTemplateSelected={handleTemplateSelected}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            fileUrl={fileUrl}
            fileName={fileName}
          />
        )}

        {step === 2 && entityType && (
          <StepMapColumns
            entityType={entityType}
            excelHeaders={excelHeaders}
            mappings={mappings}
            onChange={setMappings}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && entityType && (
          <StepConfirm
            entityType={entityType}
            fileName={fileName ?? ''}
            mappings={mappings}
            onDuplicate={onDuplicate}
            onDuplicateChange={setOnDuplicate}
            previewRows={[]}
            onStart={handleStart}
            onBack={() => setStep(2)}
            isStarting={isStarting}
          />
        )}

        {step === 4 && jobId && <StepProgress jobId={jobId} onReset={handleReset} />}
      </CardContent>
    </Card>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/import/ImportWizard.tsx
git commit -m "feat(web): add ImportWizard orchestrator component with step indicator"
```

---

## Task 18: Next.js — RecentImports DataTable

**File to create:** `apps/web/src/components/import/RecentImports.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImportEntityType, ImportJobStatus } from '@exeteam/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { listImportJobs } from '@/lib/api/import';
import type { ImportJobDto } from '@/lib/api/import';

function statusBadge(status: string) {
  switch (status) {
    case 'done':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Terminé</Badge>;
    case 'failed':
      return <Badge variant="destructive">Échec</Badge>;
    case 'processing':
      return <Badge variant="secondary">En cours</Badge>;
    case 'pending':
      return <Badge variant="outline">En attente</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

const ENTITY_LABELS: Record<string, string> = {
  clients: 'Clients',
  employees: 'Employés',
  sites: 'Sites',
  tasks: 'Tâches',
  'purchase-invoices': "Factures d'achat",
};

export function RecentImports() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['importJobs', page, entityFilter, statusFilter],
    queryFn: () =>
      listImportJobs({
        page,
        limit: 10,
        entityType: (entityFilter as ImportEntityType) || undefined,
        status: (statusFilter as ImportJobStatus) || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Imports récents</h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Toutes les entités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes les entités</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="processing">En cours</SelectItem>
              <SelectItem value="done">Terminé</SelectItem>
              <SelectItem value="failed">Échec</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>Fichier</TableHead>
              <TableHead className="text-right">Lignes</TableHead>
              <TableHead className="text-right">Erreurs</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data?.data.map((job: ImportJobDto) => (
                  <TableRow key={job.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(job.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ENTITY_LABELS[job.entityType] ?? job.entityType}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={job.fileName}>
                      {job.fileName}
                    </TableCell>
                    <TableCell className="text-sm text-right">{job.totalRows}</TableCell>
                    <TableCell className="text-sm text-right">
                      {job.errorRows > 0 ? (
                        <span className="text-destructive font-medium">{job.errorRows}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(job.status)}</TableCell>
                  </TableRow>
                ))}

            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucun import
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} sur {data.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page >= data.pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/import/RecentImports.tsx
git commit -m "feat(web): add RecentImports DataTable with pagination and filtering"
```

---

## Task 19: Next.js — Import page

**File to create:** `apps/web/src/app/(dashboard)/import/page.tsx`

```tsx
import { Metadata } from 'next';
import { ImportWizard } from '@/components/import/ImportWizard';
import { RecentImports } from '@/components/import/RecentImports';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Import Excel | ExeTeam',
  description: 'Importez vos données depuis des fichiers Excel',
};

export default function ImportPage() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Excel</h1>
        <p className="text-muted-foreground mt-1">
          Importez en masse vos clients, employés, sites, tâches ou factures depuis un fichier Excel.
        </p>
      </div>

      <ImportWizard />

      <Separator />

      <RecentImports />
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/(dashboard)/import/page.tsx
git commit -m "feat(web): add /import dashboard page"
```

---

## Task 20: Add Supabase Storage bucket configuration

The `imports` bucket must exist in Supabase Storage with private access (service role reads/writes only).

Run via Supabase SQL editor or programmatically at startup:

```sql
-- Create the imports storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('imports', 'imports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service role full access (default via service key — no policy needed)
-- Allow authenticated users to upload their own files
CREATE POLICY "Authenticated can upload imports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'imports');

-- Allow authenticated users to read their own import files
CREATE POLICY "Authenticated can read imports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'imports');
```

Also add the bucket creation to the NestJS bootstrap or a dedicated seed script if it doesn't exist:

**File to create:** `apps/api/src/import/import.bucket.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

/**
 * Ensure the "imports" bucket exists in Supabase Storage.
 * Call this from main.ts or a NestJS OnModuleInit lifecycle hook.
 */
export async function ensureImportsBucket(supabaseUrl: string, serviceRoleKey: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === 'imports');
  if (!exists) {
    await supabase.storage.createBucket('imports', { public: false });
  }
}
```

**Commit:**
```bash
git add apps/api/src/import/import.bucket.ts
git commit -m "feat(api): add Supabase Storage bucket setup helper for imports"
```

---

## Task 21: Add sidebar navigation entry

**File to edit:** `apps/web/src/components/layout/Sidebar.tsx` (or wherever nav items are defined)

Find the navigation items array and add:

```typescript
{
  label: 'Import Excel',
  href: '/import',
  icon: Upload,   // from lucide-react
},
```

Also add `Upload` to the Lucide imports at the top of the file.

**Commit:**
```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(web): add Import Excel link to sidebar navigation"
```

---

## Task 22: Final cleanup and branch commit summary

Run type-checks and lint to confirm no errors:

```bash
# From repo root
pnpm --filter @exeteam/api type-check
pnpm --filter @exeteam/web type-check
pnpm --filter @exeteam/shared type-check
pnpm --filter @exeteam/api lint
pnpm --filter @exeteam/web lint
```

Push the branch:

```bash
git push -u origin feat/import
```

Open a pull request:

```bash
gh pr create \
  --title "feat(import): Sprint 4B — Import Excel pipeline" \
  --body "## Summary
- NestJS ImportModule with BullMQ processor (ExcelJS, fuzzy matching, duplicate detection)
- Supabase Storage upload for import files (private bucket)
- 5-step ImportWizard (entity choice, drag-and-drop upload, column mapping, confirmation, live progress)
- Template save/load for reusable column mappings
- RecentImports DataTable with pagination and entity/status filters
- Error CSV download on import completion
- Shared types and field definitions in \`@exeteam/shared\`

## Test plan
- [ ] Upload a .xlsx file with client data and verify file lands in Supabase Storage \`imports\` bucket
- [ ] Parse headers returns correct column names from row 1
- [ ] Column mapper prevents proceeding with missing required fields
- [ ] Save and reload a mapping template
- [ ] Start import → BullMQ job processes rows → progress updates every 50 rows
- [ ] Duplicate clients (same SIRET) are skipped or updated per onDuplicate setting
- [ ] Employee fuzzy match rejects near-duplicate names on skip mode
- [ ] Invalid rows produce per-row errors in ImportJob.errors JSONB
- [ ] On completion, error CSV download contains correct row numbers and messages
- [ ] RecentImports table shows all jobs with correct status badges
- [ ] Files > 10 MB are rejected with a clear error
- [ ] Non-Excel files are rejected
" \
  --base main \
  --head feat/import
```

**Final commit:**
```bash
git add -A && git commit -m "chore(import): Sprint 4B complete — import Excel pipeline"
```

---

## Implementation Notes

### Environment variables required

```bash
# apps/api/.env.local
SUPABASE_URL=https://pbzbldirliihaodkxejl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=   # if using Redis auth
```

### BullMQ / Redis

If Redis is not running locally, start it with Docker:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

For production (Supabase + Fly.io or similar), use [Upstash Redis](https://upstash.com/) and set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` accordingly.

### Prisma model note

The existing `ImportLog` model in the schema uses different field names (`created`, `updated`, `errors` as Int, `errorDetails` as JSONB) versus what we need (`processedRows`, `errorRows`, `errors` as JSONB array). Task 3 renames/replaces these models as `ImportJob` (rename from `ImportLog`) via a migration. If you want to preserve the old `ImportLog` model, keep it under its original name and only add the new `ImportJob` model — update the migration accordingly.

### ExcelJS in Next.js

ExcelJS is used in the browser only for the template download helper (`downloadImportTemplate`). Since ExcelJS uses Node.js streams internally, mark the file that imports it with `'use client'` and ensure it's only called from client components. For Next.js 14, add the following to `next.config.js` if you encounter module resolution issues:

```javascript
// next.config.js
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      stream: false,
      buffer: require.resolve('buffer/'),
    };
    return config;
  },
};
module.exports = nextConfig;
```

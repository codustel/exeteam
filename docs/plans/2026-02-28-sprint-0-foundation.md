# ExeTeam Sprint 0 — Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bootstrap the ExeTeam Turborepo mono-repo with Next.js 14, NestJS, Prisma, Supabase connection, full DB schema, base UI components, and CI/CD — ready for Sprint 1 (Auth/RBAC).

**Architecture:** Turborepo mono-repo with pnpm workspaces. `apps/web` (Next.js 14 App Router) and `apps/api` (NestJS) share types from `packages/shared` and DB access from `packages/db`. The full Prisma schema is written upfront and migrated to Supabase so all subsequent sprints can build on stable tables.

**Tech Stack:** Turborepo · pnpm · Next.js 14 (App Router) · NestJS 10 · Prisma 5 · Supabase (PostgreSQL) · TypeScript strict · Tailwind CSS · shadcn/ui · Lucide React · Zod

---

## Environment Variables

```
# .env (root - for local dev, NEVER commit)
SUPABASE_URL=https://pbzbldirliihaodkxejl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiemJsZGlybGlpaGFvZGt4ZWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTM0ODksImV4cCI6MjA4Nzg2OTQ4OX0.x0Tvf7xm-4X1rePkgYMc7wTmgdaRGUBChvq58iHYvjU
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiemJsZGlybGlpaGFvZGt4ZWpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MzQ4OSwiZXhwIjoyMDg3ODY5NDg5fQ._rYZNRHGU5qXCb7F2bH3rlV4PUhJfejR8qpY0zYtHbo
DATABASE_URL=postgresql://postgres.pbzbldirliihaodkxejl:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.pbzbldirliihaodkxejl:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
```

> **Note:** Get the DATABASE_URL password from Supabase dashboard → Settings → Database → Connection string. The pooler URL uses port 6543 (for Prisma with pgbouncer=true), DIRECT_URL uses port 5432 (for migrations).

---

## Task 1: Turborepo + pnpm workspaces init

**Files:**
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.npmrc`

**Step 1: Init repo root**

```bash
cd /Users/ismael/Documents/_exeteam/_sources/exeteam
pnpm init
```

**Step 2: Install Turborepo**

```bash
pnpm add -D turbo@latest -w
```

**Step 3: Write root `package.json`**

```json
{
  "name": "exeteam",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate",
    "db:push": "turbo db:push",
    "db:studio": "pnpm --filter @exeteam/db studio",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\" --ignore-path .gitignore"
  },
  "devDependencies": {
    "turbo": "latest",
    "prettier": "^3.0.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

**Step 4: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 5: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env.test"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    },
    "studio": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Step 6: Write `.npmrc`**

```
shamefully-hoist=true
strict-peer-dependencies=false
```

**Step 7: Write `.gitignore`**

```
# Dependencies
node_modules
.pnpm-store

# Build outputs
dist
.next
build
out

# Prisma
*.db
*.db-journal

# Environment
.env
.env.local
.env.*.local
!.env.example

# Turbo
.turbo

# Testing
coverage

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Editors
.vscode/*
!.vscode/extensions.json
.idea
```

**Step 8: Create directory structure**

```bash
mkdir -p apps/web apps/api packages/db packages/shared packages/ui docs/plans docs/progress
```

**Step 9: Commit**

```bash
git add .
git commit -m "chore: init turborepo with pnpm workspaces"
```

---

## Task 2: packages/shared — Types Zod + Enums

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/enums.ts`
- Create: `packages/shared/src/types.ts`

**Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@exeteam/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Write `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 3: Write `packages/shared/src/enums.ts`**

```typescript
// Task statuses (default set, can be extended per project)
export const TASK_STATUS = {
  A_TRAITER: 'a_traiter',
  EN_ATTENTE: 'en_attente',
  EN_COURS: 'en_cours',
  A_COMPLETER: 'a_completer',
  EN_REVUE: 'en_revue',
  TERMINEE: 'terminee',
  LIVREE: 'livree',
  BLOQUEE: 'bloquee',
  ANNULEE: 'annulee',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  a_traiter: '#94A3B8',
  en_attente: '#F59E0B',
  en_cours: '#3B82F6',
  a_completer: '#8B5CF6',
  en_revue: '#06B6D4',
  terminee: '#22C55E',
  livree: '#16A34A',
  bloquee: '#EF4444',
  annulee: '#6B7280',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  a_traiter: 'À traiter',
  en_attente: 'En attente',
  en_cours: 'En cours',
  a_completer: 'À compléter',
  en_revue: 'En revue',
  terminee: 'Terminée',
  livree: 'Livrée',
  bloquee: 'Bloquée',
  annulee: 'Annulée',
};

// Statuses requiring a deliverable link
export const STATUSES_REQUIRING_DELIVERABLE: TaskStatus[] = ['terminee', 'livree'];

export const PRIORITY = {
  BASSE: 'basse',
  NORMALE: 'normale',
  HAUTE: 'haute',
  URGENTE: 'urgente',
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export const ROLE = {
  SUPER_ADMIN: 'super_admin',
  GERANT: 'gerant',
  RESPONSABLE_PRODUCTION: 'responsable_production',
  EMPLOYE: 'employe',
  COMPTABLE: 'comptable',
  RH: 'rh',
  CLIENT: 'client',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const CUSTOM_FIELD_TYPE = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  SELECT: 'select',
  BOOLEAN: 'boolean',
  URL: 'url',
  GPS: 'gps',
} as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPE)[keyof typeof CUSTOM_FIELD_TYPE];

export const CUSTOM_FIELD_SCOPE = {
  TASK: 'task',
  SITE: 'site',
} as const;

export type CustomFieldScope = (typeof CUSTOM_FIELD_SCOPE)[keyof typeof CUSTOM_FIELD_SCOPE];

export const SITE_TYPOGRAPHY = {
  PYLONE: 'pylone',
  TERRASSE_TECHNIQUE: 'terrasse_technique',
  TOUR: 'tour',
  CHATEAU_EAU: 'chateau_eau',
  SHELTER: 'shelter',
  LOCAL_TECHNIQUE: 'local_technique',
  AUTRE: 'autre',
} as const;

export type SiteTypology = (typeof SITE_TYPOGRAPHY)[keyof typeof SITE_TYPOGRAPHY];

export const PROJECT_STATUS = {
  BROUILLON: 'brouillon',
  EN_COURS: 'en_cours',
  EN_PAUSE: 'en_pause',
  TERMINE: 'termine',
  ANNULE: 'annule',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

export const QUOTE_STATUS = {
  BROUILLON: 'brouillon',
  ENVOYE: 'envoye',
  ACCEPTE: 'accepte',
  REFUSE: 'refuse',
  EXPIRE: 'expire',
} as const;

export const INVOICE_STATUS = {
  BROUILLON: 'brouillon',
  ENVOYEE: 'envoyee',
  PAYEE_PARTIELLEMENT: 'payee_partiellement',
  PAYEE: 'payee',
  EN_RETARD: 'en_retard',
  ANNULEE: 'annulee',
} as const;

export const DEMAND_STATUS = {
  NOUVELLE: 'nouvelle',
  ACCEPTEE: 'acceptee',
  EN_COURS: 'en_cours',
  LIVREE: 'livree',
  REJETEE: 'rejetee',
} as const;

export const ATTACHMENT_STATUS = {
  GENERE: 'genere',
  VALIDE: 'valide',
  FACTURE: 'facture',
} as const;

export const LEAVE_STATUS = {
  EN_ATTENTE: 'en_attente',
  APPROUVE: 'approuve',
  REFUSE: 'refuse',
  ANNULE: 'annule',
} as const;

export const CONTRACT_TYPE = {
  CDI: 'cdi',
  CDD: 'cdd',
  STAGE: 'stage',
  FREELANCE: 'freelance',
  ALTERNANCE: 'alternance',
} as const;

export const INTERLOCUTEUR_FONCTION = {
  CHEF_PROJET: 'chef_projet',
  CHARGE_AFFAIRE: 'charge_affaire',
  RESP_BE: 'resp_be',
  AUTRE: 'autre',
} as const;
```

**Step 4: Write `packages/shared/src/types.ts`**

```typescript
import { z } from 'zod';

// Custom field config schema (stored on Client/Project)
export const CustomFieldConfigSchema = z.object({
  key: z.string().min(1).regex(/^[a-z_][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'boolean', 'url', 'gps']),
  required: z.boolean().default(false),
  scope: z.enum(['task', 'site']),
  showInList: z.boolean().default(false),
  showInExport: z.boolean().default(false),
  order: z.number().int().default(0),
  options: z.array(z.string()).nullable().optional(),
  defaultValue: z.unknown().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type CustomFieldConfig = z.infer<typeof CustomFieldConfigSchema>;

export const CustomFieldsConfigSchema = z.array(CustomFieldConfigSchema);

// Pagination types
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Rendement thresholds
export const RENDEMENT_THRESHOLDS = {
  EXCELLENT: 100,
  BON: 70,
} as const;

export const RENDEMENT_COLORS = {
  excellent: '#22C55E',
  bon: '#86EFAC',
  moyen: '#F97316',
  critique: '#EF4444',
} as const;

// Brand colors
export const BRAND_COLORS = {
  primary: '#FF6600',
  dark: '#1A1A1A',
  white: '#FFFFFF',
  secondary: '#666666',
} as const;
```

**Step 5: Write `packages/shared/src/index.ts`**

```typescript
export * from './enums';
export * from './types';
```

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add enums, Zod schemas, and shared types"
```

---

## Task 3: packages/db — Prisma schema complet

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/client.ts`

**Step 1: Write `packages/db/package.json`**

```json
{
  "name": "@exeteam/db",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate deploy",
    "db:push": "prisma db push",
    "db:reset": "prisma migrate reset",
    "studio": "prisma studio",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0"
  },
  "devDependencies": {
    "prisma": "^5.10.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Write `packages/db/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ============================================================
// AUTH & RBAC
// ============================================================

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  roleId        String
  role          Role      @relation(fields: [roleId], references: [id])
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  employee      Employee?
  interlocuteur Interlocuteur?

  // Relations
  taskComments   TaskComment[]
  statusChanges  StatusHistory[]
  notifications  Notification[]
  auditLogs      AuditLog[]
  importLogs     ImportLog[]
  messages       Message[]
  createdDemands Demand[]       @relation("DemandCreatedBy")
  timeEntries    TimeEntry[]

  @@map("users")
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]
  permissions RolePermission[]

  @@map("roles")
}

model Permission {
  id       String @id @default(uuid())
  module   String
  action   String
  isMasked Boolean @default(false)

  roles RolePermission[]

  @@unique([module, action])
  @@map("permissions")
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

// ============================================================
// EMPLOYEES & HR
// ============================================================

model Department {
  id        String     @id @default(uuid())
  name      String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  employees Employee[]

  @@map("departments")
}

model Employee {
  id          String    @id @default(uuid())
  userId      String?   @unique
  user        User?     @relation(fields: [userId], references: [id])
  managerId   String?
  manager     Employee? @relation("Hierarchy", fields: [managerId], references: [id])
  subordinates Employee[] @relation("Hierarchy")
  departmentId String?
  department  Department? @relation(fields: [departmentId], references: [id])

  // Identity
  firstName       String
  lastName        String
  dateOfBirth     DateTime?
  nationality     String?
  photoUrl        String?

  // Contact
  addressLine1    String?
  addressLine2    String?
  postalCode      String?
  city            String?
  country         String?
  personalEmail   String?
  professionalEmail String?
  phone           String?

  // Contract
  contractType    String?   // cdi, cdd, stage, freelance, alternance
  entryDate       DateTime?
  endDate         DateTime?
  trialEndDate    DateTime?
  position        String?
  weeklyHours     Decimal?  @db.Decimal(5, 2)

  // Salary (encrypted via pgcrypto at app level)
  grossSalary     Decimal?  @db.Decimal(10, 2)
  netSalary       Decimal?  @db.Decimal(10, 2)
  hourlyRate      Decimal?  @db.Decimal(8, 2)
  currencyId      String?
  currency        Currency? @relation(fields: [currencyId], references: [id])

  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  // Relations
  assignedTasks    Task[]        @relation("TaskAssignee")
  timeEntries      TimeEntry[]
  leaveRequests    LeaveRequest[]
  leaveApprovals   LeaveRequest[] @relation("LeaveApprover")
  expenseReports   ExpenseReport[]
  expenseApprovals ExpenseReport[] @relation("ExpenseApprover")
  salaryHistory    Salary[]
  projects         Project[]      @relation("ProjectResponsible")
  conversations    ConversationMember[]

  @@map("employees")
}

model Salary {
  id          String   @id @default(uuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  grossSalary Decimal  @db.Decimal(10, 2)
  netSalary   Decimal? @db.Decimal(10, 2)
  effectiveDate DateTime
  notes       String?
  createdAt   DateTime @default(now())

  @@map("salaries")
}

model Recruitment {
  id          String   @id @default(uuid())
  position    String
  status      String   @default("open") // open, in_progress, closed, cancelled
  priority    String   @default("normale")
  description String?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("recruitments")
}

// ============================================================
// LEAVE & PUBLIC HOLIDAYS
// ============================================================

model LeaveType {
  id            String   @id @default(uuid())
  name          String
  daysPerYear   Decimal? @db.Decimal(5, 2)
  isCarryOver   Boolean  @default(false)
  createdAt     DateTime @default(now())

  leaveRequests LeaveRequest[]

  @@map("leave_types")
}

model LeaveRequest {
  id          String    @id @default(uuid())
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id])
  approverId  String?
  approver    Employee? @relation("LeaveApprover", fields: [approverId], references: [id])
  leaveTypeId String
  leaveType   LeaveType @relation(fields: [leaveTypeId], references: [id])
  startDate   DateTime
  endDate     DateTime
  days        Decimal   @db.Decimal(4, 1)
  status      String    @default("en_attente")
  reason      String?
  comment     String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("leave_requests")
}

model PublicHoliday {
  id        String   @id @default(uuid())
  date      DateTime @db.Date
  label     String
  type      String   @default("national")
  country   String   @default("FR")
  year      Int

  @@unique([date, country])
  @@map("public_holidays")
}

model WorkSchedule {
  id           String   @id @default(uuid())
  contractType String   @unique
  mondayHours  Decimal  @db.Decimal(4, 2) @default(8)
  tuesdayHours Decimal  @db.Decimal(4, 2) @default(8)
  wednesdayHours Decimal @db.Decimal(4, 2) @default(8)
  thursdayHours Decimal @db.Decimal(4, 2) @default(8)
  fridayHours  Decimal  @db.Decimal(4, 2) @default(8)
  saturdayHours Decimal @db.Decimal(4, 2) @default(0)
  sundayHours  Decimal  @db.Decimal(4, 2) @default(0)
  weeklyHours  Decimal  @db.Decimal(5, 2) @default(40)

  @@map("work_schedules")
}

// ============================================================
// CLIENTS, OPERATORS, INTERLOCUTEURS
// ============================================================

model Client {
  id                  String   @id @default(uuid())
  name                String
  legalName           String?
  logoUrl             String?
  addressLine1        String?
  addressLine2        String?
  postalCode          String?
  city                String?
  country             String?
  vatNumber           String?
  siret               String?
  email               String?
  phone               String?
  paymentConditions   String?
  defaultVatRate      Decimal? @db.Decimal(5, 2)
  notes               String?
  customFieldsConfig  Json?    @db.JsonB
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  deletedAt           DateTime?

  // Relations
  interlocuteurs Interlocuteur[]
  projects       Project[]
  codesProduits  CodeProduit[]
  sites          Site[]
  quotes         Quote[]
  orders         Order[]
  invoices       Invoice[]
  attachments    Attachment[]
  demands        Demand[]
  tags           EntityTag[]    @relation("ClientTags")
  operators      ClientOperator[]

  @@map("clients")
}

model Operator {
  id          String   @id @default(uuid())
  name        String
  logoUrl     String?
  description String?
  contact     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  projects Project[]
  sites    Site[]
  clients  ClientOperator[]

  @@map("operators")
}

model ClientOperator {
  clientId   String
  operatorId String
  client     Client   @relation(fields: [clientId], references: [id])
  operator   Operator @relation(fields: [operatorId], references: [id])

  @@id([clientId, operatorId])
  @@map("client_operators")
}

model Interlocuteur {
  id        String   @id @default(uuid())
  userId    String?  @unique
  user      User?    @relation(fields: [userId], references: [id])
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])

  firstName  String
  lastName   String
  email      String?
  phone      String?
  fonction   String?  // chef_projet, charge_affaire, resp_be, autre
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  deletedAt  DateTime?

  projectContacts Project[] @relation("ProjectContact")
  demands         Demand[]

  @@map("interlocuteurs")
}

// ============================================================
// SITES
// ============================================================

model SiteTypology {
  id        String   @id @default(uuid())
  name      String   @unique
  slug      String   @unique
  isActive  Boolean  @default(true)
  order     Int      @default(0)
  createdAt DateTime @default(now())

  sites Site[]

  @@map("site_typologies")
}

model Site {
  id               String        @id @default(uuid())
  reference        String
  name             String
  address          String?
  postalCode       String?
  commune          String?
  departement      String?
  country          String        @default("FR")
  latitude         Decimal?      @db.Decimal(10, 7)
  longitude        Decimal?      @db.Decimal(10, 7)
  typologieId      String?
  typologie        SiteTypology? @relation(fields: [typologieId], references: [id])
  clientId         String
  client           Client        @relation(fields: [clientId], references: [id])
  operatorId       String?
  operator         Operator?     @relation(fields: [operatorId], references: [id])
  customFieldsData Json?         @db.JsonB
  isActive         Boolean       @default(true)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  deletedAt        DateTime?

  tasks   Task[]
  demands Demand[]

  @@unique([clientId, reference])
  @@map("sites")
}

// ============================================================
// PROJECTS & TASKS
// ============================================================

model Project {
  id                  String    @id @default(uuid())
  reference           String    @unique
  title               String
  description         String?
  clientId            String
  client              Client    @relation(fields: [clientId], references: [id])
  operatorId          String?
  operator            Operator? @relation(fields: [operatorId], references: [id])
  responsibleId       String?
  responsible         Employee? @relation("ProjectResponsible", fields: [responsibleId], references: [id])
  contactId           String?
  contact             Interlocuteur? @relation("ProjectContact", fields: [contactId], references: [id])
  status              String    @default("brouillon")
  priority            String    @default("normale")
  plannedStartDate    DateTime?
  plannedEndDate      DateTime?
  actualStartDate     DateTime?
  actualEndDate       DateTime?
  budgetHours         Decimal?  @db.Decimal(8, 2)
  customFieldsConfig  Json?     @db.JsonB
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  deletedAt           DateTime?

  tasks       Task[]
  demands     Demand[]
  attachments Attachment[]
  quotes      Quote[]
  tags        EntityTag[]  @relation("ProjectTags")

  @@map("projects")
}

model Task {
  id                String    @id @default(uuid())
  reference         String    @unique
  title             String
  description       String?
  projectId         String
  project           Project   @relation(fields: [projectId], references: [id])
  siteId            String?
  site              Site?     @relation(fields: [siteId], references: [id])
  codeProduitId     String
  codeProduit       CodeProduit @relation(fields: [codeProduitId], references: [id])
  employeeId        String?
  employee          Employee? @relation("TaskAssignee", fields: [employeeId], references: [id])
  demandId          String?   @unique
  demand            Demand?   @relation(fields: [demandId], references: [id])

  status            String    @default("a_traiter")
  priority          String    @default("normale")
  dateReception     DateTime?
  plannedStartDate  DateTime?
  plannedEndDate    DateTime?
  actualStartDate   DateTime?
  actualEndDate     DateTime?
  dateLastStatus    DateTime?
  estimatedHours    Decimal?  @db.Decimal(6, 2)
  budgetHours       Decimal?  @db.Decimal(6, 2)
  facturable        Boolean   @default(true)
  deliverableLinks  String[]
  customFieldsData  Json?     @db.JsonB

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  timeEntries   TimeEntry[]
  comments      TaskComment[]
  statusHistory StatusHistory[]
  deliverables  TaskDeliverable[]
  tags          EntityTag[]       @relation("TaskTags")

  @@map("tasks")
}

model TaskComment {
  id          String   @id @default(uuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorId    String
  author      User     @relation(fields: [authorId], references: [id])
  content     String
  attachments String[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("task_comments")
}

model StatusHistory {
  id             String   @id @default(uuid())
  taskId         String
  task           Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  previousStatus String
  newStatus      String
  changedAt      DateTime @default(now())
  comment        String?

  @@map("status_history")
}

model TaskDeliverable {
  id        String   @id @default(uuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  url       String
  type      String?  // sharepoint, onedrive, dropbox, gdrive, url
  label     String?
  createdAt DateTime @default(now())

  @@map("task_deliverables")
}

model TimeEntry {
  id         String   @id @default(uuid())
  taskId     String
  task       Task     @relation(fields: [taskId], references: [id])
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id])
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  date       DateTime @db.Date
  hours      Decimal  @db.Decimal(4, 2)
  comment    String?
  isValidated Boolean @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("time_entries")
}

// ============================================================
// CODES PRODUITS
// ============================================================

model CodeProduit {
  id            String   @id @default(uuid())
  code          String   @unique
  designation   String
  productType   String?  // etude, plan, note_calcul, releve, doe, apd, pdb, maj, autre
  unitType      String?  // piece, heure, forfait, ml, m2
  unitPrice     Decimal  @db.Decimal(10, 2)
  timeGamme     Decimal? @db.Decimal(6, 2) // hours per unit
  clientId      String
  client        Client   @relation(fields: [clientId], references: [id])
  currencyId    String?
  currency      Currency? @relation(fields: [currencyId], references: [id])
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tasks         Task[]
  invoiceLines  InvoiceLine[]
  quotelines    QuoteLine[]
  demands       Demand[]
  attachmentLines AttachmentLine[]

  @@map("codes_produits")
}

// ============================================================
// DEMANDS
// ============================================================

model Demand {
  id              String    @id @default(uuid())
  reference       String    @unique
  projectId       String
  project         Project   @relation(fields: [projectId], references: [id])
  clientId        String
  client          Client    @relation(fields: [clientId], references: [id])
  codeProduitId   String?
  codeProduit     CodeProduit? @relation(fields: [codeProduitId], references: [id])
  siteId          String?
  site            Site?     @relation(fields: [siteId], references: [id])
  demandeurId     String?
  demandeur       Interlocuteur? @relation(fields: [demandeurId], references: [id])
  createdById     String
  createdBy       User      @relation("DemandCreatedBy", fields: [createdById], references: [id])
  employeeId      String?
  employee        Employee? @relation(fields: [employeeId], references: [id])

  title           String
  description     String?
  dataLink        String?
  status          String    @default("nouvelle")
  priority        String    @default("normale")
  requestedAt     DateTime  @default(now())
  desiredDelivery DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  task Task?

  @@map("demands")
}

// ============================================================
// COMMERCIAL
// ============================================================

model Attachment {
  id          String   @id @default(uuid())
  reference   String   @unique
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  projectId   String?
  project     Project? @relation(fields: [projectId], references: [id])
  period      String   // "2024-01"
  status      String   @default("genere")
  totalHt     Decimal  @db.Decimal(10, 2)
  currencyId  String?
  currency    Currency? @relation(fields: [currencyId], references: [id])
  pdfUrl      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  lines    AttachmentLine[]
  invoices Invoice[]

  @@map("attachments")
}

model AttachmentLine {
  id             String      @id @default(uuid())
  attachmentId   String
  attachment     Attachment  @relation(fields: [attachmentId], references: [id])
  codeProduitId  String
  codeProduit    CodeProduit @relation(fields: [codeProduitId], references: [id])
  siteId         String?
  quantity       Decimal     @db.Decimal(8, 2)
  unitPrice      Decimal     @db.Decimal(10, 2)
  totalHt        Decimal     @db.Decimal(10, 2)

  @@map("attachment_lines")
}

model Quote {
  id            String   @id @default(uuid())
  reference     String   @unique
  clientId      String
  client        Client   @relation(fields: [clientId], references: [id])
  quoteDate     DateTime @default(now())
  validUntil    DateTime?
  status        String   @default("brouillon")
  totalHt       Decimal  @db.Decimal(10, 2)
  vatRate       Decimal  @db.Decimal(5, 2) @default(20)
  vatAmount     Decimal  @db.Decimal(10, 2)
  totalTtc      Decimal  @db.Decimal(10, 2)
  discount      Decimal? @db.Decimal(5, 2)
  currencyId    String?
  currency      Currency? @relation(fields: [currencyId], references: [id])
  conditions    String?
  pdfUrl        String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  lines  QuoteLine[]
  orders Order[]

  @@map("quotes")
}

model QuoteLine {
  id            String      @id @default(uuid())
  quoteId       String
  quote         Quote       @relation(fields: [quoteId], references: [id])
  codeProduitId String?
  codeProduit   CodeProduit? @relation(fields: [codeProduitId], references: [id])
  designation   String
  quantity      Decimal     @db.Decimal(8, 2)
  unitPrice     Decimal     @db.Decimal(10, 2)
  totalHt       Decimal     @db.Decimal(10, 2)
  order         Int         @default(0)

  @@map("quote_lines")
}

model Order {
  id          String   @id @default(uuid())
  reference   String   @unique
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  quoteId     String?
  quote       Quote?   @relation(fields: [quoteId], references: [id])
  orderDate   DateTime
  amount      Decimal  @db.Decimal(10, 2)
  status      String   @default("en_attente")
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  invoices Invoice[]

  @@map("orders")
}

model Invoice {
  id             String      @id @default(uuid())
  reference      String      @unique
  clientId       String
  client         Client      @relation(fields: [clientId], references: [id])
  orderId        String?
  order          Order?      @relation(fields: [orderId], references: [id])
  attachmentId   String?
  attachment     Attachment? @relation(fields: [attachmentId], references: [id])
  invoiceDate    DateTime    @default(now())
  dueDate        DateTime?
  status         String      @default("brouillon")
  totalHt        Decimal     @db.Decimal(10, 2)
  vatRate        Decimal     @db.Decimal(5, 2) @default(20)
  vatAmount      Decimal     @db.Decimal(10, 2)
  totalTtc       Decimal     @db.Decimal(10, 2)
  amountPaid     Decimal     @db.Decimal(10, 2) @default(0)
  currencyId     String?
  currency       Currency?   @relation(fields: [currencyId], references: [id])
  pdfUrl         String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  lines InvoiceLine[]

  @@map("invoices")
}

model InvoiceLine {
  id            String      @id @default(uuid())
  invoiceId     String
  invoice       Invoice     @relation(fields: [invoiceId], references: [id])
  codeProduitId String?
  codeProduit   CodeProduit? @relation(fields: [codeProduitId], references: [id])
  designation   String
  quantity      Decimal     @db.Decimal(8, 2)
  unitPrice     Decimal     @db.Decimal(10, 2)
  totalHt       Decimal     @db.Decimal(10, 2)
  order         Int         @default(0)

  @@map("invoice_lines")
}

// ============================================================
// ACCOUNTING
// ============================================================

model Supplier {
  id        String   @id @default(uuid())
  name      String
  email     String?
  phone     String?
  address   String?
  vatNumber String?
  siret     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  purchaseInvoices PurchaseInvoice[]

  @@map("suppliers")
}

model PurchaseInvoice {
  id          String    @id @default(uuid())
  reference   String    @unique
  supplierId  String
  supplier    Supplier  @relation(fields: [supplierId], references: [id])
  invoiceDate DateTime
  dueDate     DateTime?
  status      String    @default("en_attente")
  totalHt     Decimal   @db.Decimal(10, 2)
  vatAmount   Decimal   @db.Decimal(10, 2)
  totalTtc    Decimal   @db.Decimal(10, 2)
  amountPaid  Decimal   @db.Decimal(10, 2) @default(0)
  fileUrl     String?
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("purchase_invoices")
}

model ExpenseReport {
  id          String    @id @default(uuid())
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id])
  approverId  String?
  approver    Employee? @relation("ExpenseApprover", fields: [approverId], references: [id])
  title       String
  description String?
  amount      Decimal   @db.Decimal(8, 2)
  vatAmount   Decimal?  @db.Decimal(8, 2)
  status      String    @default("en_attente")
  expenseDate DateTime
  receiptUrl  String?
  currencyId  String?
  currency    Currency? @relation(fields: [currencyId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("expense_reports")
}

// ============================================================
// TAGS
// ============================================================

model Tag {
  id        String   @id @default(uuid())
  name      String   @unique
  color     String   @default("#FF6600")
  createdAt DateTime @default(now())

  entities EntityTag[]

  @@map("tags")
}

model EntityTag {
  tagId      String
  tag        Tag    @relation(fields: [tagId], references: [id])
  entityType String // client, project, task
  entityId   String

  client  Client?  @relation("ClientTags", fields: [entityId], references: [id], map: "entity_tag_client")
  project Project? @relation("ProjectTags", fields: [entityId], references: [id], map: "entity_tag_project")
  taskRel Task?    @relation("TaskTags", fields: [entityId], references: [id], map: "entity_tag_task")

  @@id([tagId, entityType, entityId])
  @@map("entity_tags")
}

// ============================================================
// MESSAGING
// ============================================================

model Conversation {
  id        String   @id @default(uuid())
  name      String?
  isGroup   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members  ConversationMember[]
  messages Message[]

  @@map("conversations")
}

model ConversationMember {
  conversationId String
  employeeId     String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  employee       Employee     @relation(fields: [employeeId], references: [id])
  joinedAt       DateTime     @default(now())

  @@id([conversationId, employeeId])
  @@map("conversation_members")
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  senderId       String
  sender         User         @relation(fields: [senderId], references: [id])
  content        String
  fileUrl        String?
  isRead         Boolean      @default(false)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@map("messages")
}

// ============================================================
// NOTIFICATIONS
// ============================================================

model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String
  title     String
  body      String?
  link      String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@map("notifications")
}

// ============================================================
// IMPORT
// ============================================================

model ImportTemplate {
  id        String   @id @default(uuid())
  name      String
  clientId  String?
  mapping   Json     @db.JsonB
  dedupeRules Json?  @db.JsonB
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  importLogs ImportLog[]

  @@map("import_templates")
}

model ImportLog {
  id         String          @id @default(uuid())
  templateId String?
  template   ImportTemplate? @relation(fields: [templateId], references: [id])
  userId     String
  user       User            @relation(fields: [userId], references: [id])
  fileName   String
  status     String          @default("pending")
  created    Int             @default(0)
  updated    Int             @default(0)
  errors     Int             @default(0)
  ignored    Int             @default(0)
  errorDetails Json?         @db.JsonB
  createdAt  DateTime        @default(now())
  completedAt DateTime?

  @@map("import_logs")
}

// ============================================================
// SETTINGS & ADMINISTRATION
// ============================================================

model CompanySettings {
  id              String   @id @default("singleton")
  legalName       String?
  tradeName       String?
  addressLine1    String?
  postalCode      String?
  city            String?
  country         String   @default("FR")
  siret           String?
  siren           String?
  vatNumber       String?
  rcs             String?
  capital         String?
  iban            String?  // encrypted
  bic             String?
  email           String?
  phone           String?
  logoUrl         String?
  legalMentions   String?
  defaultCurrencyId String?
  currency        Currency? @relation(fields: [defaultCurrencyId], references: [id])
  quotePrefix     String   @default("DEV")
  invoicePrefix   String   @default("FAC")
  projectPrefix   String   @default("PRJ")
  taskPrefix      String   @default("TSK")
  updatedAt       DateTime @updatedAt

  @@map("company_settings")
}

model Currency {
  id        String   @id @default(uuid())
  code      String   @unique // ISO 4217: EUR, USD, MAD, etc.
  symbol    String
  name      String
  isDefault Boolean  @default(false)
  isActive  Boolean  @default(true)

  employees        Employee[]
  codesProduits    CodeProduit[]
  attachments      Attachment[]
  quotes           Quote[]
  invoices         Invoice[]
  expenseReports   ExpenseReport[]
  companySettings  CompanySettings[]

  @@map("currencies")
}

// ============================================================
// AUDIT
// ============================================================

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  action     String
  entityType String
  entityId   String?
  changes    Json?    @db.JsonB
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@map("audit_logs")
}
```

**Step 3: Write `packages/db/src/client.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Step 4: Write `packages/db/src/index.ts`**

```typescript
export { prisma } from './client';
export * from '@prisma/client';
```

**Step 5: Write `packages/db/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 6: Install dependencies and generate client**

```bash
pnpm --filter @exeteam/db install
pnpm --filter @exeteam/db db:generate
```

Expected: Prisma client generated in `packages/db/node_modules/.prisma/client`

**Step 7: Run migration**

```bash
# First, set DATABASE_URL and DIRECT_URL in packages/db/.env
# Get the DB password from Supabase Dashboard → Settings → Database
pnpm --filter @exeteam/db db:push
```

Expected: All tables created in Supabase. No errors.

**Step 8: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add complete Prisma schema for all ExeTeam entities"
```

---

## Task 4: apps/api — NestJS setup

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/app.controller.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/src/prisma/prisma.service.ts`

**Step 1: Write `apps/api/package.json`**

```json
{
  "name": "@exeteam/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/throttler": "^5.1.0",
    "@supabase/supabase-js": "^2.39.0",
    "@exeteam/db": "workspace:*",
    "@exeteam/shared": "workspace:*",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1",
    "zod": "^3.22.0",
    "nestjs-zod": "^3.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/node": "^20.11.0",
    "@types/passport-jwt": "^4.0.1",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
```

**Step 2: Write `apps/api/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global Zod validation pipe
  app.useGlobalPipes(new ZodValidationPipe());

  // CORS - tighten in production
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`🚀 ExeTeam API running on port ${port}`, 'Bootstrap');
}

bootstrap();
```

**Step 3: Write `apps/api/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';

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
    PrismaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**Step 4: Write `apps/api/src/app.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

**Step 5: Write `apps/api/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@exeteam/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Step 6: Write `apps/api/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Step 7: Write `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Step 8: Write `apps/api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

**Step 9: Write `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

**Step 10: Install and test**

```bash
pnpm --filter @exeteam/api install
pnpm --filter @exeteam/api dev
```

Expected: `🚀 ExeTeam API running on port 3001`
Test: `curl http://localhost:3001/api/v1/health` → `{"status":"ok",...}`

**Step 11: Commit**

```bash
git add apps/api/
git commit -m "feat(api): bootstrap NestJS with Prisma module and health endpoint"
```

---

## Task 5: apps/web — Next.js 14 setup

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.js`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`

**Step 1: Create Next.js app**

```bash
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
```

Then update `apps/web/package.json` to add workspace deps:

```json
{
  "name": "@exeteam/web",
  "dependencies": {
    "@exeteam/shared": "workspace:*",
    "@supabase/ssr": "^0.3.0",
    "@supabase/supabase-js": "^2.39.0",
    "next": "14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next-themes": "^0.3.0",
    "lucide-react": "^0.330.0",
    "@tanstack/react-query": "^5.20.0",
    "zustand": "^4.5.0",
    "zod": "^3.22.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "tailwindcss-animate": "^1.0.7",
    "sonner": "^1.4.0",
    "framer-motion": "^11.0.0"
  }
}
```

**Step 2: Write `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // ExeTeam brand colors
        brand: {
          orange: '#FF6600',
          dark: '#1A1A1A',
          gray: '#666666',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

**Step 3: Write `apps/web/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 24 100% 50%;        /* #FF6600 orange */
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 24 100% 50%;           /* orange ring */
    --radius: 0.5rem;
  }

  .dark {
    --background: 0 0% 3.9%;       /* #0A0A0A near black */
    --foreground: 0 0% 98%;
    --card: 0 0% 6%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 6%;
    --popover-foreground: 0 0% 98%;
    --primary: 24 100% 50%;
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 24 100% 50%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground font-sans; }
}
```

**Step 4: Write `apps/web/src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

**Step 5: Write `apps/web/src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}
```

**Step 6: Write `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'ExeTeam',
    template: '%s | ExeTeam',
  },
  description: 'Gestion de Bureau d\'Étude & Travaux',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 7: Write `apps/web/src/app/page.tsx` (placeholder)**

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
```

**Step 8: Create ThemeProvider component**

Create `apps/web/src/components/theme-provider.tsx`:

```tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

**Step 9: Init shadcn/ui**

```bash
cd apps/web
pnpx shadcn@latest init
```

Choose: TypeScript=yes, style=default, color=Orange, CSS variables=yes

**Step 10: Install core shadcn components**

```bash
pnpx shadcn@latest add button badge card input label select separator sheet dialog dropdown-menu navigation-menu toast skeleton avatar command
```

**Step 11: Write `apps/web/next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@exeteam/shared', '@exeteam/ui'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pbzbldirliihaodkxejl.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
```

**Step 12: Write `apps/web/.env.local` (do not commit)**

```
NEXT_PUBLIC_SUPABASE_URL=https://pbzbldirliihaodkxejl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiemJsZGlybGlpaGFvZGt4ZWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTM0ODksImV4cCI6MjA4Nzg2OTQ4OX0.x0Tvf7xm-4X1rePkgYMc7wTmgdaRGUBChvq58iHYvjU
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

**Step 13: Test dev server**

```bash
pnpm --filter @exeteam/web dev
```

Expected: Next.js running on http://localhost:3000, redirects to /login (404 for now — login page comes in Sprint 1)

**Step 14: Commit**

```bash
git add apps/web/
git commit -m "feat(web): bootstrap Next.js 14 with Tailwind, shadcn/ui, Supabase client, ExeTeam brand theme"
```

---

## Task 6: packages/ui — Base UI components

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/components/stats-bar.tsx`
- Create: `packages/ui/src/lib/utils.ts`

**Step 1: Write `packages/ui/package.json`**

```json
{
  "name": "@exeteam/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@exeteam/shared": "workspace:*",
    "react": "^18.2.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.330.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0"
  },
  "peerDependencies": {
    "react": "^18.2.0"
  }
}
```

**Step 2: Write `packages/ui/src/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3: Write `packages/ui/src/components/stats-bar.tsx`**

```tsx
import React from 'react';
import { cn } from '../lib/utils';
import { LucideIcon } from 'lucide-react';

export interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

interface StatsBarProps {
  stats: StatItem[];
  className?: string;
}

export function StatsBar({ stats, className }: StatsBarProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-4 p-4 bg-card rounded-lg border border-border',
        className,
      )}
    >
      {stats.map((stat, i) => (
        <div key={i} className={cn('flex flex-col gap-1', stat.className)}>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {stat.label}
          </span>
          <span className="text-2xl font-bold text-foreground">{stat.value}</span>
          {stat.trendValue && (
            <span
              className={cn('text-xs', {
                'text-green-500': stat.trend === 'up',
                'text-red-500': stat.trend === 'down',
                'text-muted-foreground': stat.trend === 'neutral',
              })}
            >
              {stat.trendValue}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Write `packages/ui/src/index.ts`**

```typescript
export { StatsBar } from './components/stats-bar';
export type { StatItem } from './components/stats-bar';
export { cn } from './lib/utils';
```

**Step 5: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): add StatsBar and cn utility"
```

---

## Task 7: .env.example + GitHub Actions CI

**Files:**
- Create: `.env.example`
- Create: `.github/workflows/ci.yml`

**Step 1: Write `.env.example`**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Prisma)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Next.js (client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# NestJS API
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret

# Redis (for BullMQ jobs - Sprint 3+)
REDIS_URL=redis://localhost:6379

# App settings
NODE_ENV=development
```

**Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint
```

**Step 3: Commit**

```bash
git add .env.example .github/
git commit -m "chore: add .env.example and GitHub Actions CI"
```

---

## Task 8: Final integration test + README

**Step 1: Verify full build**

```bash
pnpm install
pnpm db:generate
pnpm build
```

Expected: All packages build without TypeScript errors.

**Step 2: Write root README.md**

```markdown
# ExeTeam

Gestion de Bureau d'Étude & Travaux — Next.js 14 + NestJS + Supabase

## Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **Backend:** NestJS, Prisma
- **Database:** Supabase (PostgreSQL)
- **Mono-repo:** Turborepo + pnpm

## Development

```bash
# Install
pnpm install

# Generate Prisma client
pnpm db:generate

# Run dev (both web + api)
pnpm dev

# Web only: http://localhost:3000
# API only: http://localhost:3001/api/v1/health
```

## Structure

```
exeteam/
├── apps/web/     # Next.js 14
├── apps/api/     # NestJS
├── packages/db/  # Prisma schema
├── packages/shared/  # Types/enums
└── packages/ui/  # UI components
```

## Sprints

- **Sprint 0** ✅ Foundation (this)
- **Sprint 1** Auth & RBAC
- **Sprint 2** Modules métier (parallel)
- ...
```

**Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions

Sprint 0 complete: Turborepo mono-repo bootstrapped with Next.js 14,
NestJS, Prisma schema (all CDC entities), Supabase integration,
Tailwind/shadcn brand theme."
```

---

## Verification

After Sprint 0:

```bash
# All packages install
pnpm install

# No TypeScript errors
pnpm type-check

# Lint passes
pnpm lint

# Prisma schema is valid
pnpm --filter @exeteam/db exec prisma validate

# API starts
pnpm --filter @exeteam/api dev
# → curl http://localhost:3001/api/v1/health returns {"status":"ok"}

# Web starts
pnpm --filter @exeteam/web dev
# → http://localhost:3000 redirects to /login
```

Check Supabase Dashboard → Table Editor → verify all tables created.

# ExeTeam Sprint 5 — UX Polish + Tests + Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge all feature branches, polish the UX (global search, column selector, animations, mobile optimizations), add comprehensive test coverage (E2E with Playwright + unit tests with Vitest), deploy to production via Coolify on Hostinger VPS, configure Supabase RLS, add Sentry monitoring, and implement RGPD compliance features.

**Tech Stack:** Playwright · Vitest · Framer Motion · Coolify · Sentry · cmdk (Command palette) · Supabase RLS

**Branch:** `feat/polish`

**Prerequisite:** Sprints 0–4 all merged into `main`.

---

## Phase 1 — Branch Merge & Cleanup

### Task 1: Create `feat/polish` branch and merge all feature branches

```bash
git checkout main && git pull origin main
git checkout -b feat/polish
```

Verify all feature branches are merged into main:
```bash
git branch --merged main
```

If any feature branch is unmerged, merge it now (resolve conflicts if needed):
```bash
git merge feat/clients feat/sites feat/custom-fields feat/rh-conges \
  feat/projects-tasks feat/demands feat/commercial feat/messaging \
  feat/accounting feat/import feat/dashboards
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/polish branch"
```

---

### Task 2: Full build & lint verification

Run the full Turborepo pipeline to ensure everything compiles after merges:

```bash
pnpm build
pnpm lint
pnpm db:migrate
```

Fix any TypeScript errors, lint warnings, or migration issues. This task is not complete until the build passes cleanly.

**Commit:**
```bash
git add -A && git commit -m "fix: resolve post-merge build and lint issues"
```

---

## Phase 2 — UX Polish

### Task 3: Global search Command Palette (Ctrl+K / Cmd+K)

**Install dependency:**
```bash
cd apps/web && pnpm add cmdk
```

**File to create:** `apps/web/src/components/command-palette.tsx`

Implement a `<CommandPalette />` component using the `cmdk` library:
- Trigger with `Ctrl+K` (Windows/Linux) / `Cmd+K` (macOS)
- Search across: Clients, Projects, Tasks, Employees, Sites
- Each result links to its detail page
- Group results by entity type with Lucide icons
- Debounced search input (300ms)
- API endpoint: `GET /api/search?q=...` returning top 5 results per entity
- Keyboard navigation (arrow keys + Enter)
- Show recent searches in empty state

**NestJS side — File to create:** `apps/api/src/modules/search/search.module.ts`

Create `SearchModule` with `SearchController` and `SearchService`:
- `GET /search?q=<query>` — searches across clients (name, code), projects (name, reference), tasks (name, reference), employees (firstName, lastName), sites (name, reference)
- Uses Prisma `contains` (case-insensitive) on key fields
- Returns `{ clients: [], projects: [], tasks: [], employees: [], sites: [] }` with max 5 per category
- Protected by `JwtAuthGuard`

Register `SearchModule` in `AppModule`.

**Integration:** Add `<CommandPalette />` to the root layout (`apps/web/src/app/(dashboard)/layout.tsx`), rendered once globally.

**Commit:**
```bash
git add -A && git commit -m "feat: add global search command palette (Ctrl+K)"
```

---

### Task 4: ColumnSelector component improvements

**File to modify:** `apps/web/src/components/column-selector.tsx` (or create if not exists)

Ensure the `<ColumnSelector />` component:
- Renders as a popover triggered by a settings icon button
- Lists all columns with checkboxes (checked = visible)
- Persists selection to `localStorage` keyed by table name
- Supports drag-and-drop column reordering (use `@dnd-kit/sortable`)
- Has "Reset to defaults" button
- Integrates with custom fields columns (showInList: true)

```bash
cd apps/web && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Verify integration on all DataTable pages: `/clients`, `/projects`, `/tasks`, `/employees`, `/sites`, `/demands`, `/commercial/*`.

**Commit:**
```bash
git add -A && git commit -m "feat: enhance ColumnSelector with drag-and-drop reordering and persistence"
```

---

### Task 5: Framer Motion page transitions and micro-animations

**Install:**
```bash
cd apps/web && pnpm add framer-motion
```

**File to create:** `apps/web/src/components/motion.tsx`

Create reusable motion wrappers:
- `<PageTransition>` — wraps page content with fade-in + slight upward slide (`opacity: 0→1, y: 10→0`, duration 200ms)
- `<FadeIn>` — simple fade-in wrapper for cards/sections
- `<StaggerChildren>` — staggers children animation (for list items, dashboard cards)
- `<SlideIn direction="left|right|up|down">` — directional slide-in

Apply `<PageTransition>` to the dashboard layout so all page navigations animate.

Apply `<StaggerChildren>` to:
- Dashboard KPI cards
- StatsBar items
- DataTable rows on first load

Keep animations subtle (200–300ms, ease-out). Do NOT animate on every re-render — only on mount/page change.

**Commit:**
```bash
git add -A && git commit -m "feat: add Framer Motion page transitions and micro-animations"
```

---

### Task 6: Mobile responsive improvements + infinite scroll

Audit all pages for mobile (< 768px):

1. **Sidebar:** Ensure sidebar collapses to a hamburger menu on mobile (already partially implemented — verify and fix)
2. **DataTables:** Add horizontal scroll wrapper on mobile. Show only essential columns (name, status, date) on < 640px.
3. **Forms:** Stack form fields vertically on mobile. Full-width inputs.
4. **Dashboard cards:** 1 column on mobile, 2 on tablet, 4 on desktop.

**Infinite scroll for mobile lists:**

**File to create:** `apps/web/src/hooks/use-infinite-scroll.ts`

```typescript
// Hook that uses IntersectionObserver to trigger fetchNextPage
// when a sentinel element enters viewport.
// Works with TanStack Query's useInfiniteQuery.
```

Apply to `/clients`, `/projects`, `/tasks`, `/employees` list pages — on mobile only (detect with `useMediaQuery`). Desktop keeps pagination.

**Commit:**
```bash
git add -A && git commit -m "feat: improve mobile responsiveness and add infinite scroll for mobile lists"
```

---

### Task 7: JSONB custom fields filtering in DataTables

Add filter UI for custom fields columns in DataTables:

- For `text` custom fields: text input filter
- For `select` custom fields: dropdown with options from config
- For `number` custom fields: min/max range inputs
- For `date` custom fields: date range picker
- For `boolean` custom fields: checkbox

**NestJS side:** Update list endpoints (`/tasks`, `/sites`, etc.) to accept `customFields` query parameter:
```
GET /tasks?customFields={"field_key":{"op":"eq","value":"X"}}
```

Prisma raw query using GIN index:
```sql
WHERE custom_fields_data @> '{"field_key": "X"}'::jsonb
```

**Commit:**
```bash
git add -A && git commit -m "feat: add JSONB custom fields filtering in DataTables"
```

---

## Phase 3 — Tests

### Task 8: Playwright E2E setup

**Install:**
```bash
cd apps/web && pnpm add -D @playwright/test
npx playwright install chromium
```

**File to create:** `apps/web/playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  baseURL: 'http://localhost:3000',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

**File to create:** `apps/web/e2e/helpers/auth.ts`

Helper to login via Supabase Auth before tests (use a test user seeded in DB):
```typescript
// Signs in with test credentials and stores auth state
// for reuse across tests via storageState
```

Add `test:e2e` script to root `package.json`:
```json
"test:e2e": "cd apps/web && npx playwright test"
```

**Commit:**
```bash
git add -A && git commit -m "chore: set up Playwright E2E testing infrastructure"
```

---

### Task 9: E2E tests — Authentication flows

**File to create:** `apps/web/e2e/auth.spec.ts`

Test scenarios:
1. Login with valid credentials → redirects to `/dashboard`
2. Login with invalid credentials → shows error message
3. Logout → redirects to `/login`
4. Protected route access without auth → redirects to `/login`
5. 2FA flow for super_admin/gerant/comptable roles
6. Password reset flow (request email)
7. Session persistence (reload page stays logged in)

**Commit:**
```bash
git add -A && git commit -m "test: add Playwright E2E tests for authentication flows"
```

---

### Task 10: E2E tests — Projects & Tasks CRUD

**File to create:** `apps/web/e2e/projects-tasks.spec.ts`

Test scenarios:
1. Create a new project → appears in project list
2. Edit project details → changes persist
3. Create a task within a project → appears in task list
4. Change task status (Kanban drag or dropdown) → status updates
5. Add time entry to a task → hours logged
6. Add comment to a task → comment appears in timeline
7. Deliverable link required for "Terminée" status → validation works
8. Filter tasks by status, assignee, date range
9. Gantt view renders correctly
10. Delete a task → removed from list (with confirmation dialog)

**Commit:**
```bash
git add -A && git commit -m "test: add Playwright E2E tests for projects and tasks CRUD"
```

---

### Task 11: E2E tests — Import Excel

**File to create:** `apps/web/e2e/import.spec.ts`

Prepare a test fixture: `apps/web/e2e/fixtures/test-import.xlsx` (small Excel file with 5 rows of task data).

Test scenarios:
1. Upload Excel file → columns detected
2. Map columns to fields → mapping saved
3. Preview import data → shows parsed rows
4. Execute import → tasks created in DB
5. Duplicate detection → warns about duplicates
6. Invalid data → shows row-level errors

**Commit:**
```bash
git add -A && git commit -m "test: add Playwright E2E tests for Excel import wizard"
```

---

### Task 12: E2E tests — Invoices & Commercial

**File to create:** `apps/web/e2e/commercial.spec.ts`

Test scenarios:
1. Create an attachment (group of billable tasks) → saves correctly
2. Generate a quote from attachment → PDF downloads
3. Convert quote to order → status changes
4. Create an invoice → invoice number auto-generated
5. Mark invoice as paid → status updates
6. Verify only facturable=true tasks appear in attachments
7. Filter invoices by status, client, date

**Commit:**
```bash
git add -A && git commit -m "test: add Playwright E2E tests for commercial module (invoices, quotes)"
```

---

### Task 13: Vitest unit tests setup

**Install in API:**
```bash
cd apps/api && pnpm add -D vitest @vitest/coverage-v8 unplugin-swc
```

**File to create:** `apps/api/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [swc.vite()],
});
```

Add `test` and `test:cov` scripts to `apps/api/package.json`.
Add `test:unit` script to root `package.json`:
```json
"test:unit": "cd apps/api && pnpm vitest run"
```

**Commit:**
```bash
git add -A && git commit -m "chore: set up Vitest unit testing for NestJS API"
```

---

### Task 14: Unit tests — Critical NestJS services

**Files to create:**

1. `apps/api/src/modules/tasks/tasks.service.spec.ts`
   - Test rendement calculation: `(gamme × quantité) / heures_réelles × 100`
   - Test délai R→L calculation (business days, excluding weekends and public holidays)
   - Test status transition validation (deliverable link required)
   - Test facturable flag filtering

2. `apps/api/src/modules/leaves/leaves.service.spec.ts`
   - Test leave balance calculation
   - Test leave overlap detection
   - Test approval workflow (N+1 validation)
   - Test public holiday exclusion from leave days

3. `apps/api/src/modules/commercial/attachments.service.spec.ts`
   - Test task grouping logic (by project/site/codeProduit)
   - Test only facturable=true tasks included
   - Test amount calculations (HT, TVA, TTC)

4. `apps/api/src/modules/search/search.service.spec.ts`
   - Test multi-entity search
   - Test result limiting (max 5 per category)
   - Test empty query returns empty results

Use Vitest mocks for Prisma (`vi.mock`) — create a shared `apps/api/src/test/prisma-mock.ts` helper.

**Commit:**
```bash
git add -A && git commit -m "test: add Vitest unit tests for critical NestJS services"
```

---

## Phase 4 — Supabase RLS & RGPD

### Task 15: Configure Supabase RLS policies

**File to create:** `packages/db/prisma/migrations/YYYYMMDD_rls_policies/migration.sql`

Create a migration with RLS policies for all tables. Key rules:

1. **Users can only see data for their organization:**
   ```sql
   ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "org_isolation" ON "Client"
     USING (organization_id = current_setting('app.current_org_id')::uuid);
   ```

2. **Role-based access:**
   - `super_admin` → full access to all tables
   - `gerant` → full access within org
   - `chef_projet` → read all, write own projects/tasks
   - `technicien` → read assigned tasks, write own time entries
   - `comptable` → full access to accounting tables, read others
   - `rh` → full access to employees/leaves, read others
   - `commercial` → full access to commercial tables, read others
   - `assistante` → read all within org

3. **Sensitive tables with extra restrictions:**
   - `Salary` — only `rh`, `comptable`, `gerant`, `super_admin`
   - `ExpenseReport` — owner + `comptable` + `gerant` + `super_admin`
   - `DashboardRentabilite` endpoint — only `gerant`, `comptable`, `super_admin`

4. **Set `app.current_org_id` and `app.current_role` in NestJS middleware** before each request using `SET LOCAL`:
   ```typescript
   // In a NestJS interceptor:
   await prisma.$executeRawUnsafe(
     `SET LOCAL app.current_org_id = '${orgId}';`
   );
   ```

**Note:** Use parameterized queries to prevent SQL injection in the interceptor.

**Commit:**
```bash
git add -A && git commit -m "feat: configure Supabase RLS policies for multi-tenant isolation"
```

---

### Task 16: RGPD compliance — Data export & right to erasure

**NestJS endpoints:**

1. `GET /users/:id/export` — Export all user data as JSON (RGPD Art. 15)
   - Collects: user profile, employee data, time entries, leave requests, comments, messages
   - Returns a ZIP file with JSON files per entity
   - Restricted to: the user themselves + `super_admin` + `gerant`

2. `DELETE /users/:id/anonymize` — Right to erasure (RGPD Art. 17)
   - Does NOT delete records (would break referential integrity)
   - Anonymizes: firstName → "Anonyme", lastName → "Utilisateur", email → `anon_{uuid}@deleted.local`, phone → null
   - Clears: avatar, address, personal notes
   - Deactivates the user account
   - Restricted to: `super_admin` only
   - Requires confirmation token (sent by email)

**File to create:** `apps/api/src/modules/rgpd/rgpd.module.ts`

Create `RgpdModule` with `RgpdController` and `RgpdService`.

**Next.js:** Add a "Mes données" section in user profile settings with:
- "Exporter mes données" button → triggers download
- "Supprimer mon compte" button → shows confirmation dialog → sends anonymization request to admin

**Commit:**
```bash
git add -A && git commit -m "feat: add RGPD data export and right to erasure endpoints"
```

---

## Phase 5 — Deployment

### Task 17: Environment variables & Docker configuration

**File to create:** `.env.example`

```env
# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.pbzbldirliihaodkxejl.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.pbzbldirliihaodkxejl.supabase.co:5432/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://pbzbldirliihaodkxejl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Auth
JWT_SECRET=your-jwt-secret
NEXTAUTH_SECRET=your-nextauth-secret

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=your-sentry-auth-token

# App
NEXT_PUBLIC_APP_URL=https://app.exeteam.fr
API_URL=https://api.exeteam.fr

# VAPID (Web Push)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@exeteam.fr
SMTP_PASS=your-smtp-password
```

**File to create:** `Dockerfile` (multi-stage, root level)

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
RUN pnpm build

# Stage 3: API runner
FROM node:20-alpine AS api
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

# Stage 4: Web runner
FROM node:20-alpine AS web
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
```

**File to create:** `docker-compose.yml`

```yaml
version: '3.8'
services:
  web:
    build:
      context: .
      target: web
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - api

  api:
    build:
      context: .
      target: api
    ports:
      - "3001:3001"
    env_file: .env
```

**Commit:**
```bash
git add -A && git commit -m "chore: add Dockerfile, docker-compose.yml, and .env.example"
```

---

### Task 18: Sentry error monitoring

**Install:**
```bash
cd apps/web && pnpm add @sentry/nextjs
cd apps/api && pnpm add @sentry/nestjs @sentry/node
```

**Next.js Sentry setup:**

Run `npx @sentry/wizard@latest -i nextjs` or manually create:
- `apps/web/sentry.client.config.ts`
- `apps/web/sentry.server.config.ts`
- `apps/web/sentry.edge.config.ts`
- Update `apps/web/next.config.js` with `withSentryConfig` wrapper

Configure:
- DSN from env: `process.env.NEXT_PUBLIC_SENTRY_DSN`
- `tracesSampleRate: 0.2` (production)
- `replaysSessionSampleRate: 0.1`
- Source maps upload

**NestJS Sentry setup:**

**File to create:** `apps/api/src/common/sentry.interceptor.ts`

```typescript
// Global exception filter that captures errors to Sentry
// Integrates with NestJS exception handling pipeline
```

Initialize Sentry in `apps/api/src/main.ts` before app bootstrap.

**Commit:**
```bash
git add -A && git commit -m "feat: integrate Sentry error monitoring for web and API"
```

---

### Task 19: Coolify deployment configuration

**File to create:** `docs/deployment/coolify-setup.md`

Document the Coolify deployment process on Hostinger VPS:

1. **VPS setup:**
   - Install Coolify on Hostinger VPS (Ubuntu 22.04+)
   - Configure domain: `app.exeteam.fr` (web), `api.exeteam.fr` (API)
   - SSL via Let's Encrypt (automatic with Coolify)

2. **Coolify project setup:**
   - Create two services: `exeteam-web` and `exeteam-api`
   - Connect GitHub repository
   - Set build pack: Dockerfile
   - Set target: `web` or `api` respectively
   - Configure environment variables from `.env.example`

3. **CI/CD:**
   - Auto-deploy on push to `main`
   - Health check endpoints: `GET /api/health` (API), `GET /` (Web)

4. **Database migrations:**
   - Run `pnpm db:migrate deploy` as a pre-deploy hook in Coolify
   - Or use a one-off command after deploy

**NestJS health endpoint:**

**File to create:** `apps/api/src/modules/health/health.module.ts`

Simple health check endpoint `GET /health` returning `{ status: "ok", timestamp, version }`.

**Commit:**
```bash
git add -A && git commit -m "feat: add Coolify deployment config and health endpoint"
```

---

### Task 20: Turbo pipeline configuration verification

**File to verify/update:** `turbo.json`

Ensure the Turborepo pipeline includes all necessary scripts:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

**Commit:**
```bash
git add -A && git commit -m "chore: verify and update turbo.json pipeline configuration"
```

---

## Phase 6 — Final Verification

### Task 21: Full pipeline verification

Run the complete verification pipeline:

```bash
# 1. Type checking
pnpm type-check

# 2. Lint
pnpm lint

# 3. Build
pnpm build

# 4. Unit tests
pnpm test:unit

# 5. E2E tests (requires running dev server)
pnpm test:e2e
```

Fix any issues found. This task is not complete until ALL commands pass.

**Commit:**
```bash
git add -A && git commit -m "fix: resolve all issues from final verification pipeline"
```

---

### Task 22: Merge `feat/polish` into `main`

```bash
git checkout main
git merge feat/polish --no-ff -m "feat: Sprint 5 — UX polish, tests, RLS, RGPD, deployment"
```

Tag the release:
```bash
git tag v1.0.0 -m "ExeTeam v1.0 — Production ready"
```

---

## Summary Checklist

| # | Task | Phase |
|---|------|-------|
| 1 | Create branch, merge features | Merge |
| 2 | Full build & lint verification | Merge |
| 3 | Global search Command Palette (Ctrl+K) | UX |
| 4 | ColumnSelector improvements | UX |
| 5 | Framer Motion animations | UX |
| 6 | Mobile responsive + infinite scroll | UX |
| 7 | JSONB custom fields filtering | UX |
| 8 | Playwright E2E setup | Tests |
| 9 | E2E: Authentication flows | Tests |
| 10 | E2E: Projects & Tasks CRUD | Tests |
| 11 | E2E: Import Excel | Tests |
| 12 | E2E: Commercial / Invoices | Tests |
| 13 | Vitest unit tests setup | Tests |
| 14 | Unit tests: Critical services | Tests |
| 15 | Supabase RLS policies | Security |
| 16 | RGPD data export & erasure | Security |
| 17 | Docker + env configuration | Deploy |
| 18 | Sentry monitoring | Deploy |
| 19 | Coolify deployment + health endpoint | Deploy |
| 20 | Turbo pipeline verification | Deploy |
| 21 | Full pipeline verification | Verify |
| 22 | Merge to main + tag v1.0.0 | Release |

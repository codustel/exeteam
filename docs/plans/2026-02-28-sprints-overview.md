# ExeTeam — Sprints Overview & Execution Guide

## Sprint Dependency Graph

```
Sprint 0 (Foundation)
    └── Sprint 1 (Auth & RBAC)
            ├── Sprint 2A (Clients + Operators)    ─┐
            ├── Sprint 2B (Sites)                   ├── Parallel
            ├── Sprint 2C (Codes Produits + CF)     ├── 4 subagents
            └── Sprint 2D (RH + Congés)            ─┘
                    ├── Sprint 3A (Projets & Tâches)  ─┐
                    ├── Sprint 3B (Demandes + Notifs)   ├── Parallel
                    ├── Sprint 3C (Commercial)           ├── 4 subagents
                    └── Sprint 3D (Messagerie)          ─┘
                            ├── Sprint 4A (Comptabilité)  ─┐
                            ├── Sprint 4B (Import Excel)    ├── Parallel
                            └── Sprint 4C (Dashboards)     ─┘ 3 subagents
                                    └── Sprint 5 (Polish + Tests + Deploy)
```

## Sprint Plans Index

| Sprint | Plan File | Status |
|--------|-----------|--------|
| Sprint 0 | `2026-02-28-sprint-0-foundation.md` | Ready |
| Sprint 1 | `2026-02-28-sprint-1-auth-rbac.md` | Ready |
| Sprint 2A | `2026-02-28-sprint-2a-clients.md` | To create |
| Sprint 2B | `2026-02-28-sprint-2b-sites.md` | To create |
| Sprint 2C | `2026-02-28-sprint-2c-custom-fields.md` | To create |
| Sprint 2D | `2026-02-28-sprint-2d-rh-conges.md` | To create |
| Sprint 3A | `2026-02-28-sprint-3a-projects-tasks.md` | To create |
| Sprint 3B | `2026-02-28-sprint-3b-demands.md` | To create |
| Sprint 3C | `2026-02-28-sprint-3c-commercial.md` | To create |
| Sprint 3D | `2026-02-28-sprint-3d-messaging.md` | To create |
| Sprint 4A | `2026-02-28-sprint-4a-accounting.md` | To create |
| Sprint 4B | `2026-02-28-sprint-4b-import.md` | To create |
| Sprint 4C | `2026-02-28-sprint-4c-dashboards.md` | To create |
| Sprint 5 | `2026-02-28-sprint-5-polish-deploy.md` | To create |

## How to Execute Sprints

### Sequential sprints (0 and 1)

Open a new Claude Code session and say:
> "Execute docs/plans/2026-02-28-sprint-0-foundation.md using superpowers:executing-plans"

### Parallel sprints (2, 3, 4)

Dispatch multiple agents simultaneously. Example for Sprint 2:
> "Dispatch parallel agents for Sprint 2: use superpowers:dispatching-parallel-agents with plans sprint-2a-clients, sprint-2b-sites, sprint-2c-custom-fields, sprint-2d-rh-conges"

Each subagent:
1. Creates its branch: `git checkout -b feat/<module>`
2. Implements tasks from its plan file
3. Commits on its branch
4. Writes progress to `docs/progress/sprint-X-subagent-Y.md`

### Context window management

If a subagent session reaches ~80% context:
1. Commit current work: `git add . && git commit -m "wip(module): checkpoint"`
2. Write to `docs/progress/sprint-X-subagent-Y.md`:
   - What was done
   - What remains
   - Current file being worked on
3. End session

To resume: open new session and say:
> "Resume Sprint 2A from docs/progress/sprint-2-subagent-2a.md"

## Key Credentials

```
SUPABASE_URL=https://pbzbldirliihaodkxejl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Password for DATABASE_URL: Get from Supabase Dashboard → Settings → Database → Connection string.

## Git Branch Strategy

- `main` — stable, deployable
- `feat/clients` — Sprint 2A
- `feat/sites` — Sprint 2B
- `feat/custom-fields` — Sprint 2C
- `feat/rh-conges` — Sprint 2D
- `feat/projects-tasks` — Sprint 3A
- `feat/demands` — Sprint 3B
- `feat/commercial` — Sprint 3C
- `feat/messaging` — Sprint 3D
- `feat/accounting` — Sprint 4A
- `feat/import` — Sprint 4B
- `feat/dashboards` — Sprint 4C

## Sprint 2 Subagent Briefs Summary

### Sprint 2A — Clients + Operators + Interlocuteurs (`feat/clients`)

**Scope:**
- NestJS: ClientsModule, OperatorsModule, InterlocuteursModule (full CRUD, all endpoints)
- Prisma relations: Client → Interlocuteur, Client ↔ Operator (M2M via ClientOperator)
- Guards: JwtAuthGuard + PermissionsGuard on all endpoints
- Next.js pages:
  - `/clients` — List with StatsBar (4 KPIs), search, filters, DataTable, "+ Nouveau Client" button
  - `/clients/[id]` — Detail with tabs: Infos | Interlocuteurs | Sites | Projets | Codes produits | Commercial | Champs perso | Historique
  - `/operators` — List + CRUD
- Tags M2M on clients
- Logo upload to Supabase Storage
- TanStack Query for data fetching
- Zod DTOs on API

**Key patterns to follow:**
- Look at Sprint 0 patterns (Prisma schema, NestJS module structure, Next.js App Router)
- Use `@exeteam/shared` enums
- Use `@exeteam/ui` StatsBar component
- Column selector, pagination (page + limit), search debounced 300ms

### Sprint 2B — Sites (`feat/sites`)

**Scope:**
- NestJS: SitesModule (CRUD, filter by client/operator/typologie)
- Next.js pages:
  - `/sites` — List with StatsBar, search, filters (client, typography, commune), DataTable
  - `/sites/[id]` — Detail with tabs: Infos + carte GPS (if coords exist) | Tâches | Historique | Custom fields
- GPS coordinates display (if latitude/longitude filled)
- SiteTypology comes from DB (seeded in Sprint 1)
- Custom fields data display (rendered from client's custom_fields_config)
- Bandeau stats: Sites actifs | Tâches en cours | Par typologie | Dernière intervention

### Sprint 2C — Codes Produits + Custom Fields Engine (`feat/custom-fields`)

**Scope:**
- NestJS: CodeProduitsModule, CustomFieldsModule
- Custom fields engine:
  - GET /custom-fields/config?clientId=X — returns merged config (client + project)
  - PUT /clients/:id/custom-fields-config — update config
  - PUT /projects/:id/custom-fields-config — update project config
- DynamicForm component (Next.js): generates form from CustomFieldConfig[]
- DataTable with dynamic columns (showInList: true columns added right of standard columns)
- ColumnSelector component
- GIN index usage in Prisma raw queries for JSONB filtering
- Form builder UI on client detail tab "Champs personnalisables"

### Sprint 2D — Module RH + Congés (`feat/rh-conges`)

**Scope:**
- NestJS: EmployeesModule, SalariesModule, LeavesModule, PublicHolidaysModule, WorkSchedulesModule
- Hierarchy N+1 (managerId recursive relation)
- Leave workflow: create → notification to N+1 → approve/refuse → balance update
- Public holidays: fetch from Nager.Date API (`https://date.nager.at/api/v3/PublicHolidays/{year}/{country}`) and store in DB
- Next.js pages:
  - `/employees` — List with StatsBar
  - `/employees/[id]` — Full employee detail (all tabs from CDC section 11)
  - `/leaves` — Leave requests list + calendar view
  - `/leaves/[id]` — Detail
- Org chart (simple tree view component)
- Bandeau stats: Effectif | Taux occupation | Rendement moyen | En congé

## Sprint 3 Subagent Briefs Summary

### Sprint 3A — Projets & Tâches (`feat/projects-tasks`)

**Scope (critical module):**
- NestJS: ProjectsModule, TasksModule, TimeEntriesModule
- Tasks: all CDC 4.2.1 fields + custom_fields_data JSONB
- Status history auto-created on status change
- Comment thread (TaskComment)
- Deliverable link validation (block Terminée/Livrée without link)
- Délai R→L calculation (working days, exclude weekends + public_holidays table)
- Rendement calculation: (gamme × quantité) / heures_réelles × 100
- facturable flag (impacts attachments in Sprint 3C)
- Gantt view (Frappe Gantt library)
- Next.js pages: /projects (list) + /projects/[id] (full tabs) + /tasks (global list) + /tasks/[id] (full detail with comment timeline)
- Kanban view by status
- Configurable statuses per project

### Sprint 3B — Demandes Client + Notifications (`feat/demands`)

**Scope:**
- Demand workflow + auto-task generation
- Web Push API notifications (service worker + VAPID keys)
- In-app notifications table (badge on header bell icon)
- Email notifications (simple fetch to Supabase Edge Functions or direct SMTP)
- Next.js: /demands, /demands/[id], client portal /portal/demands

### Sprint 3C — Module Commercial (`feat/commercial`)

**Scope:**
- Attachments: group tasks by project/site/codeProduit, ONLY facturable=true tasks
- Quote, Order, Invoice CRUD
- PDF generation: React-PDF templates with ExeTeam branding
- Currency symbol on all amounts
- Next.js: /commercial/attachments, /commercial/quotes, /commercial/orders, /commercial/invoices

### Sprint 3D — Messagerie (`feat/messaging`)

**Scope:**
- Supabase Realtime channels for chat
- ConversationMember management
- Message CRUD with file attachments
- Presence (who is online)
- Next.js: /messages (split pane layout)

## Sprint 4 Subagent Briefs Summary

### Sprint 4A — Comptabilité (`feat/accounting`)

- PurchaseInvoice, Supplier, ExpenseReport CRUD
- ExpenseReport approval workflow (N+1)
- VAT management (multiple rates)
- Next.js: /accounting/* pages

### Sprint 4B — Import Excel (`feat/import`)

- ImportWizard component (multi-step)
- ExcelJS parsing
- Column mapping UI
- Entity resolution (fuzzy match employees)
- BullMQ job for async import
- ImportTemplate save/load
- Duplicate detection
- Next.js: /import (wizard)

### Sprint 4C — Dashboards (`feat/dashboards`)

- Dashboard Général: KPIs overview
- Dashboard Production: tasks by status, rendement, délai R→L
- Dashboard Financier: revenue, invoices, pending
- Dashboard Client: per-client metrics (no internal financial data)
- Dashboard Employé: personal stats
- Rapport Rentabilité Salariale: salary cost vs revenue (permission-gated)
- Recharts for all charts
- Export Excel (ExcelJS) with custom fields

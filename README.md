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

## Environment Setup

Copy `.env.example` and fill in credentials:

```bash
cp .env.example .env
# Also: apps/web/.env.local (NEXT_PUBLIC_* vars)
# Also: packages/db/.env (DATABASE_URL + DIRECT_URL for migrations)
```

Get the Supabase database password from: Dashboard → Settings → Database → Connection string.

## Push DB schema to Supabase

```bash
# After setting DATABASE_URL and DIRECT_URL in packages/db/.env:
pnpm --filter @exeteam/db db:push
```

## Structure

```
exeteam/
├── apps/web/         # Next.js 14 (port 3000)
├── apps/api/         # NestJS (port 3001)
├── packages/db/      # Prisma schema + client
├── packages/shared/  # Types, enums, Zod schemas
└── packages/ui/      # Shared UI components (StatsBar, etc.)
```

## Sprints

- **Sprint 0** ✅ Foundation (this)
- **Sprint 1** Auth & RBAC (Supabase Auth + NestJS guards)
- **Sprint 2** Modules métier (Clients, Sites, RH, Custom fields)
- **Sprint 3** Projects, Tasks, Demands, Messaging
- **Sprint 4** Accounting, Import, Dashboards

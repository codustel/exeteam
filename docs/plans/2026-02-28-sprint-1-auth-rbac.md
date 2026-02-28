# ExeTeam Sprint 1 — Auth & RBAC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete authentication (Supabase Auth + 2FA TOTP) and RBAC system (roles, permissions, NestJS guards) with the User↔Employee/Interlocuteur association workflow.

**Architecture:** Supabase Auth handles sessions/JWT via `@supabase/ssr`. NestJS extracts the JWT and validates via custom guards. Role/permission data is stored in Postgres (via Prisma). The 2FA flow uses Supabase MFA (TOTP). User-to-Employee association is Admin-only.

**Tech Stack:** Supabase Auth · @supabase/ssr · NestJS Guards/Decorators · Passport-JWT · next-themes · shadcn/ui

**Prerequisite:** Sprint 0 complete, all tables in Supabase, Prisma client generated.

---

## Task 1: Seed default roles and permissions

**Files:**
- Create: `packages/db/prisma/seed.ts`
- Modify: `packages/db/package.json` (add seed script)

**Step 1: Write `packages/db/prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ROLES = [
  { name: 'super_admin', description: 'Administrateur technique — accès total', isSystem: true },
  { name: 'gerant', description: 'Gérant/Directeur — accès métier complet sauf admin', isSystem: true },
  { name: 'responsable_production', description: 'Responsable BE/production', isSystem: true },
  { name: 'employe', description: 'Collaborateur standard', isSystem: true },
  { name: 'comptable', description: 'Accès module comptabilité', isSystem: true },
  { name: 'rh', description: 'Ressources humaines', isSystem: true },
  { name: 'client', description: 'Accès portail client uniquement', isSystem: true },
];

const DEFAULT_PERMISSIONS = [
  // Projects
  { module: 'projects', action: 'create' },
  { module: 'projects', action: 'read' },
  { module: 'projects', action: 'update' },
  { module: 'projects', action: 'delete' },
  { module: 'projects', action: 'assign' },
  // Tasks
  { module: 'tasks', action: 'create' },
  { module: 'tasks', action: 'read' },
  { module: 'tasks', action: 'update' },
  { module: 'tasks', action: 'delete' },
  { module: 'tasks', action: 'assign' },
  { module: 'tasks', action: 'timelog' },
  // Sites
  { module: 'sites', action: 'create' },
  { module: 'sites', action: 'read' },
  { module: 'sites', action: 'update' },
  { module: 'sites', action: 'delete' },
  // Clients
  { module: 'clients', action: 'create' },
  { module: 'clients', action: 'read' },
  { module: 'clients', action: 'update' },
  { module: 'clients', action: 'delete' },
  // Employees
  { module: 'employees', action: 'create' },
  { module: 'employees', action: 'read' },
  { module: 'employees', action: 'update' },
  // HR sensitive
  { module: 'hr', action: 'read_salaries', isMasked: true },
  { module: 'hr', action: 'update_salaries', isMasked: true },
  // Commercial (masked by default)
  { module: 'commercial', action: 'create_quotes', isMasked: true },
  { module: 'commercial', action: 'read_quotes', isMasked: true },
  { module: 'commercial', action: 'create_invoices', isMasked: true },
  { module: 'commercial', action: 'read_invoices', isMasked: true },
  { module: 'commercial', action: 'generate_pdf', isMasked: true },
  // Rentability
  { module: 'reports', action: 'read_salary_rentability', isMasked: true },
  { module: 'reports', action: 'read_financial_dashboard', isMasked: true },
  // Accounting
  { module: 'accounting', action: 'full_access', isMasked: true },
  // Leaves
  { module: 'leaves', action: 'read' },
  { module: 'leaves', action: 'create' },
  { module: 'leaves', action: 'approve' },
  // Messaging
  { module: 'messaging', action: 'access' },
  // Tags
  { module: 'tags', action: 'create' },
  { module: 'tags', action: 'update' },
  { module: 'tags', action: 'delete' },
  // Import
  { module: 'import', action: 'excel' },
  // Users (super admin only)
  { module: 'users', action: 'create' },
  { module: 'users', action: 'update' },
  { module: 'users', action: 'deactivate' },
  { module: 'users', action: 'associate' },
  // Admin
  { module: 'admin', action: 'roles' },
  { module: 'admin', action: 'settings' },
  // Custom fields
  { module: 'custom_fields', action: 'configure' },
  { module: 'custom_fields', action: 'read' },
  { module: 'custom_fields', action: 'update' },
];

// Role-permission matrix
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'], // all permissions
  gerant: [
    'projects.*', 'tasks.*', 'sites.*', 'clients.*', 'employees.create',
    'employees.read', 'employees.update', 'hr.read_salaries',
    'commercial.*', 'reports.*', 'leaves.*', 'messaging.access',
    'tags.*', 'import.excel', 'custom_fields.*',
  ],
  responsable_production: [
    'projects.*', 'tasks.*', 'sites.*', 'clients.read', 'clients.create',
    'clients.update', 'employees.read', 'leaves.read', 'leaves.approve',
    'messaging.access', 'tags.*', 'import.excel', 'custom_fields.*',
  ],
  employe: [
    'tasks.read', 'tasks.update', 'tasks.timelog', 'sites.read',
    'projects.read', 'clients.read', 'leaves.create', 'leaves.read',
    'messaging.access',
  ],
  comptable: [
    'accounting.full_access', 'commercial.*', 'reports.read_financial_dashboard',
    'clients.read', 'employees.read',
  ],
  rh: [
    'employees.*', 'hr.*', 'leaves.*', 'clients.read',
  ],
  client: [
    'projects.read', 'tasks.read', 'sites.read',
  ],
};

async function main() {
  console.log('Seeding roles and permissions...');

  // Upsert permissions
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: perm,
      create: perm,
    });
  }

  // Upsert roles
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role,
    });
  }

  // Upsert default currency (EUR)
  await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', symbol: '€', name: 'Euro', isDefault: true },
  });

  // Upsert company settings singleton
  await prisma.companySettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', country: 'FR', quotePrefix: 'DEV', invoicePrefix: 'FAC', projectPrefix: 'PRJ', taskPrefix: 'TSK' },
  });

  // Upsert site typologies
  const typologies = [
    { name: 'Pylône', slug: 'pylone', order: 1 },
    { name: 'Terrasse Technique (TT)', slug: 'terrasse_technique', order: 2 },
    { name: 'Tour', slug: 'tour', order: 3 },
    { name: "Château d'eau", slug: 'chateau_eau', order: 4 },
    { name: 'Shelter', slug: 'shelter', order: 5 },
    { name: 'Local technique', slug: 'local_technique', order: 6 },
    { name: 'Autre', slug: 'autre', order: 7 },
  ];
  for (const typo of typologies) {
    await prisma.siteTypology.upsert({
      where: { slug: typo.slug },
      update: typo,
      create: typo,
    });
  }

  // Upsert work schedule defaults
  await prisma.workSchedule.upsert({
    where: { contractType: 'cdi' },
    update: {},
    create: {
      contractType: 'cdi',
      mondayHours: 8, tuesdayHours: 8, wednesdayHours: 8,
      thursdayHours: 8, fridayHours: 8, saturdayHours: 0, sundayHours: 0,
      weeklyHours: 40,
    },
  });

  console.log('✅ Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

**Step 2: Add seed script to `packages/db/package.json`**

Add to scripts:
```json
"db:seed": "ts-node --project tsconfig.json prisma/seed.ts"
```

Add to devDependencies:
```json
"ts-node": "^10.9.0"
```

**Step 3: Run seed**

```bash
pnpm --filter @exeteam/db db:seed
```

Expected: "✅ Seed complete"

**Step 4: Commit**

```bash
git add packages/db/prisma/seed.ts packages/db/package.json
git commit -m "feat(db): add seed for roles, permissions, site typologies, defaults"
```

---

## Task 2: NestJS Auth module (JWT + Supabase)

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/auth.guard.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/supabase.strategy.ts`
- Create: `apps/api/src/auth/roles.decorator.ts`
- Create: `apps/api/src/auth/roles.guard.ts`
- Create: `apps/api/src/auth/permissions.decorator.ts`
- Create: `apps/api/src/auth/permissions.guard.ts`
- Create: `apps/api/src/auth/current-user.decorator.ts`

**Step 1: Write `apps/api/src/auth/supabase.strategy.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;       // Supabase user UUID
  email: string;
  role: string;      // Supabase role (authenticated)
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  employeeId: string | null;
  interlocuteurId: string | null;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Supabase JWT secret from dashboard → Settings → API → JWT Secret
      secretOrKey: config.get<string>('SUPABASE_JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        employee: { select: { id: true } },
        interlocuteur: { select: { id: true } },
      },
    });

    if (!user) throw new UnauthorizedException('User not found or inactive');

    const permissions = user.role.permissions.map(
      (rp) => `${rp.permission.module}.${rp.permission.action}`,
    );

    return {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions,
      employeeId: user.employee?.id ?? null,
      interlocuteurId: user.interlocuteur?.id ?? null,
    };
  }
}
```

**Step 2: Write `apps/api/src/auth/auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('supabase') {}
```

**Step 3: Write `apps/api/src/auth/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './supabase.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
```

**Step 4: Write `apps/api/src/auth/roles.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**Step 5: Write `apps/api/src/auth/roles.guard.ts`**

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { AuthUser } from './supabase.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser;
    const hasRole = requiredRoles.includes(user.roleName) || user.roleName === 'super_admin';

    if (!hasRole) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
```

**Step 6: Write `apps/api/src/auth/permissions.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

**Step 7: Write `apps/api/src/auth/permissions.guard.ts`**

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { AuthUser } from './supabase.strategy';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser;

    // super_admin bypasses all permission checks
    if (user.roleName === 'super_admin') return true;

    const hasAll = required.every((perm) => user.permissions.includes(perm));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
```

**Step 8: Write `apps/api/src/auth/auth.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private supabase;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.supabase = createClient(
      config.get('SUPABASE_URL')!,
      config.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  async inviteUser(email: string, roleId: string, associateEmployeeId?: string, associateInterlocuteurId?: string) {
    // Create Supabase Auth user via admin invite
    const { data, error } = await this.supabase.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(error.message);

    const supabaseUserId = data.user.id;

    // Create User in our DB
    const user = await this.prisma.user.create({
      data: {
        id: supabaseUserId,
        email,
        roleId,
        ...(associateEmployeeId
          ? { employee: { connect: { id: associateEmployeeId } } }
          : {}),
        ...(associateInterlocuteurId
          ? { interlocuteur: { connect: { id: associateInterlocuteurId } } }
          : {}),
      },
      include: { role: true, employee: true, interlocuteur: true },
    });

    return user;
  }

  async deactivateUser(userId: string) {
    await this.supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  async updateUserRole(userId: string, roleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });
  }
}
```

**Step 9: Write `apps/api/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from './supabase.strategy';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [PassportModule],
  providers: [SupabaseStrategy, AuthService, RolesGuard, PermissionsGuard],
  exports: [AuthService, RolesGuard, PermissionsGuard, SupabaseStrategy],
})
export class AuthModule {}
```

**Step 10: Register AuthModule in `apps/api/src/app.module.ts`**

Add `AuthModule` to imports in `app.module.ts`.

**Step 11: Add `SUPABASE_JWT_SECRET` to `.env`**

```bash
# Get from Supabase Dashboard → Settings → API → JWT Secret
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
```

**Step 12: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(api): add JWT auth guard, RBAC roles/permissions decorators"
```

---

## Task 3: Users CRUD API (Admin only)

**Files:**
- Create: `apps/api/src/users/users.module.ts`
- Create: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/users.service.ts`
- Create: `apps/api/src/users/dto/create-user.dto.ts`

**Step 1: Write `apps/api/src/users/dto/create-user.dto.ts`**

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
  associateEmployeeId: z.string().uuid().optional(),
  associateInterlocuteurId: z.string().uuid().optional(),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
```

**Step 2: Write `apps/api/src/users/users.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        role: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        interlocuteur: {
          select: { id: true, firstName: true, lastName: true, client: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: { role: true, employee: true, interlocuteur: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    return this.authService.inviteUser(
      dto.email,
      dto.roleId,
      dto.associateEmployeeId,
      dto.associateInterlocuteurId,
    );
  }

  async updateRole(id: string, roleId: string) {
    return this.authService.updateUserRole(id, roleId);
  }

  async deactivate(id: string) {
    return this.authService.deactivateUser(id);
  }
}
```

**Step 3: Write `apps/api/src/users/users.controller.ts`**

```typescript
import {
  Controller, Get, Post, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() { return this.usersService.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.usersService.findOne(id); }

  @Post()
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body('roleId') roleId: string) {
    return this.usersService.updateRole(id, roleId);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) { return this.usersService.deactivate(id); }
}
```

**Step 4: Commit**

```bash
git add apps/api/src/users/
git commit -m "feat(api): add Users CRUD API (super_admin only)"
```

---

## Task 4: Next.js login page

**Files:**
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/login/login-form.tsx`
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/lib/auth/actions.ts`

**Step 1: Write `apps/web/src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-primary mb-2">ExeTeam</div>
          <p className="text-muted-foreground text-sm">Gestion de Bureau d'Étude</p>
        </div>
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Write `apps/web/src/lib/auth/actions.ts`**

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function login(formData: FormData) {
  const result = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!result.success) {
    return { error: 'Email ou mot de passe invalide' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    return { error: 'Email ou mot de passe incorrect' };
  }

  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

**Step 3: Write `apps/web/src/app/(auth)/login/login-form.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { login } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      Se connecter
    </Button>
  );
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    setError(null);
    const result = await login(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Accédez à votre espace ExeTeam</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="vous@exeteam.fr" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Write `apps/web/src/app/(auth)/login/page.tsx`**

```tsx
import { LoginForm } from './login-form';

export const metadata = { title: 'Connexion' };

export default function LoginPage() {
  return <LoginForm />;
}
```

**Step 5: Write `apps/web/src/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                      request.nextUrl.pathname.startsWith('/setup-2fa');

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
```

**Step 6: Commit**

```bash
git add apps/web/src/app/(auth)/ apps/web/src/middleware.ts apps/web/src/lib/auth/
git commit -m "feat(web): add login page with Supabase Auth and middleware protection"
```

---

## Task 5: Main app layout (dashboard shell)

**Files:**
- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/app/(app)/dashboard/page.tsx`
- Create: `apps/web/src/components/layout/sidebar.tsx`
- Create: `apps/web/src/components/layout/header.tsx`

**Step 1: Write `apps/web/src/components/layout/sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FolderKanban, CheckSquare, MapPin, Users, Building2,
  Package, FileText, Receipt, Euro, UserCog, MessageSquare, Bell,
  Upload, Settings, BarChart3, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projets', href: '/projects', icon: FolderKanban },
  { label: 'Tâches', href: '/tasks', icon: CheckSquare },
  { label: 'Sites', href: '/sites', icon: MapPin },
  { label: 'Clients', href: '/clients', icon: Building2 },
  { label: 'Codes produits', href: '/products', icon: Package },
  { label: 'Commercial', href: '/commercial', icon: FileText },
  { label: 'Comptabilité', href: '/accounting', icon: Euro },
  { label: 'Employés', href: '/employees', icon: Users },
  { label: 'Congés', href: '/leaves', icon: CalendarDays },
  { label: 'Demandes', href: '/demands', icon: Receipt },
  { label: 'Messagerie', href: '/messages', icon: MessageSquare },
  { label: 'Import', href: '/import', icon: Upload },
  { label: 'Rapports', href: '/reports', icon: BarChart3 },
  { label: 'Administration', href: '/admin', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
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

**Step 2: Write `apps/web/src/components/layout/header.tsx`**

```tsx
'use client';

import { Bell, Moon, Sun, LogOut, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { logout } from '@/lib/auth/actions';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { setTheme, theme } = useTheme();

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Mon profil</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

**Step 3: Write `apps/web/src/app/(app)/layout.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

**Step 4: Write `apps/web/src/app/(app)/dashboard/page.tsx`**

```tsx
import { Header } from '@/components/layout/header';

export const metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        <p className="text-muted-foreground">Dashboard en cours de construction — Sprint 4</p>
      </div>
    </>
  );
}
```

**Step 5: Commit**

```bash
git add apps/web/src/app/(app)/ apps/web/src/components/layout/
git commit -m "feat(web): add app shell with sidebar navigation and dashboard layout"
```

---

## Task 6: Admin Users page (Next.js)

**Files:**
- Create: `apps/web/src/app/(app)/admin/users/page.tsx`
- Create: `apps/web/src/app/(app)/admin/users/users-table.tsx`

**Step 1: Write the Users admin page**

```tsx
// apps/web/src/app/(app)/admin/users/page.tsx
import { Header } from '@/components/layout/header';
import { UsersTable } from './users-table';

export const metadata = { title: 'Gestion des utilisateurs' };

export default function AdminUsersPage() {
  return (
    <>
      <Header title="Utilisateurs" />
      <div className="p-6">
        <UsersTable />
      </div>
    </>
  );
}
```

**Step 2: Write `apps/web/src/app/(app)/admin/users/users-table.tsx`**

Basic table shell — full implementation with invite dialog, role selector, entity association in Sprint 2+ when Employee/Interlocuteur modules exist.

```tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export function UsersTable() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Utilisateurs</h2>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Inviter un utilisateur
        </Button>
      </div>
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Interface complète disponible après Sprint 2 (Employees + Interlocuteurs)
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/(app)/admin/
git commit -m "feat(web): add admin users page shell"
```

---

## Verification

```bash
# Full build passes
pnpm build

# API starts with auth working
pnpm --filter @exeteam/api dev
# Test protected endpoint:
# curl -H "Authorization: Bearer invalid" http://localhost:3001/api/v1/users
# → 401 Unauthorized

# Web: Login page visible, dashboard protected
pnpm --filter @exeteam/web dev
# → http://localhost:3000 → /login (login form displayed)
# → After login → /dashboard (sidebar + placeholder)

# Seed complete
pnpm --filter @exeteam/db db:seed
# → 7 roles + permissions in DB
```

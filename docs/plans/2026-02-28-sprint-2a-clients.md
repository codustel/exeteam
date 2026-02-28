# ExeTeam Sprint 2A — Clients + Operators + Interlocuteurs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the full Clients, Operators, Interlocuteurs, and Tags modules — NestJS API + Next.js UI — with paginated listings, detail pages, and form dialogs.

**Architecture:** NestJS modules expose REST endpoints guarded by JwtAuthGuard + PermissionsGuard. Next.js pages use TanStack Query + a typed `apiRequest` helper that injects the Supabase session Bearer token. The Clients detail page has a tab layout with placeholder tabs for future sprints.

**Tech Stack:** NestJS · Prisma · Zod pipes · TanStack Query · shadcn/ui · react-hook-form + zod

**Prerequisite:** Sprint 1 complete, all tables in Supabase, Prisma client generated, RBAC guards working.

---

## Task 1: Create branch `feat/clients`

```bash
git checkout main && git pull origin main
git checkout -b feat/clients
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/clients branch"
```

---

## Task 2: NestJS ClientsModule

**Files to create:**
- `apps/api/src/clients/dto/create-client.dto.ts`
- `apps/api/src/clients/dto/update-client.dto.ts`
- `apps/api/src/clients/dto/list-clients.dto.ts`
- `apps/api/src/clients/clients.service.ts`
- `apps/api/src/clients/clients.controller.ts`
- `apps/api/src/clients/clients.module.ts`

**Step 1: `apps/api/src/clients/dto/create-client.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateClientSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('FR'),
  vatNumber: z.string().optional(),
  siret: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  paymentConditions: z.number().int().optional(),
  defaultVatRate: z.number().optional(),
  notes: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
  operatorIds: z.array(z.string()).default([]),
});

export class CreateClientDto extends createZodDto(CreateClientSchema) {}
```

**Step 2: `apps/api/src/clients/dto/update-client.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { CreateClientSchema } from './create-client.dto';

export const UpdateClientSchema = CreateClientSchema.partial();

export class UpdateClientDto extends createZodDto(UpdateClientSchema) {}
```

**Step 3: `apps/api/src/clients/dto/list-clients.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListClientsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  operatorId: z.string().optional(),
  tagId: z.string().optional(),
});

export class ListClientsDto extends createZodDto(ListClientsSchema) {}
```

**Step 4: `apps/api/src/clients/clients.service.ts`**

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListClientsDto) {
    const { page, limit, search, isActive, operatorId, tagId } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where['OR'] = [
        { name: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { siret: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where['isActive'] = isActive;
    }

    if (operatorId) {
      where['operators'] = { some: { operatorId } };
    }

    if (tagId) {
      where['tags'] = { some: { tagId } };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          operators: { include: { operator: true } },
          tags: { include: { tag: true } },
          _count: { select: { sites: true, projects: true, interlocuteurs: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        operators: { include: { operator: true } },
        interlocuteurs: true,
        tags: { include: { tag: true } },
        codesProduits: { include: { currency: true } },
        _count: {
          select: { sites: true, projects: true, interlocuteurs: true, codesProduits: true },
        },
      },
    });

    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }

  async create(dto: CreateClientDto) {
    const { tagIds, operatorIds, ...data } = dto;

    return this.prisma.client.create({
      data: {
        ...data,
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
        operators: {
          create: operatorIds.map((operatorId) => ({ operatorId })),
        },
      },
      include: {
        operators: { include: { operator: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    const { tagIds, operatorIds, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        await tx.entityTag.deleteMany({ where: { clientId: id } });
      }
      if (operatorIds !== undefined) {
        await tx.clientOperator.deleteMany({ where: { clientId: id } });
      }

      return tx.client.update({
        where: { id },
        data: {
          ...data,
          ...(tagIds !== undefined && {
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
          }),
          ...(operatorIds !== undefined && {
            operators: { create: operatorIds.map((operatorId) => ({ operatorId })) },
          }),
        },
        include: {
          operators: { include: { operator: true } },
          tags: { include: { tag: true } },
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async updateLogo(id: string, logoUrl: string) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: { logoUrl } });
  }

  async getStats() {
    const [total, active, inactive] = await this.prisma.$transaction([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.client.count({ where: { isActive: false } }),
    ]);

    const withProjects = await this.prisma.client.count({
      where: { projects: { some: {} } },
    });

    return { total, active, inactive, withProjects };
  }
}
```

**Step 5: `apps/api/src/clients/clients.controller.ts`**

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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('stats')
  @RequirePermissions('clients.read')
  getStats() {
    return this.clientsService.getStats();
  }

  @Get()
  @RequirePermissions('clients.read')
  findAll(@Query() dto: ListClientsDto) {
    return this.clientsService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('clients.read')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @RequirePermissions('clients.create')
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Patch(':id/logo-url')
  @RequirePermissions('clients.update')
  updateLogoUrl(
    @Param('id') id: string,
    @Body('logoUrl') logoUrl: string,
  ) {
    return this.clientsService.updateLogo(id, logoUrl);
  }
}
```

**Step 6: `apps/api/src/clients/clients.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
```

**Commit:**
```bash
git add apps/api/src/clients
git commit -m "feat(api): add ClientsModule with CRUD, stats, and M2M tags/operators"
```

---

## Task 3: NestJS OperatorsModule

**Files to create:**
- `apps/api/src/operators/dto/create-operator.dto.ts`
- `apps/api/src/operators/operators.service.ts`
- `apps/api/src/operators/operators.controller.ts`
- `apps/api/src/operators/operators.module.ts`

**Step 1: `apps/api/src/operators/dto/create-operator.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateOperatorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  contact: z.string().optional(),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

export class CreateOperatorDto extends createZodDto(CreateOperatorSchema) {}

export const UpdateOperatorSchema = CreateOperatorSchema.partial();
export class UpdateOperatorDto extends createZodDto(UpdateOperatorSchema) {}
```

**Step 2: `apps/api/src/operators/operators.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/create-operator.dto';

@Injectable()
export class OperatorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.operator.findMany({
      where: search
        ? { name: { contains: search, mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { clients: true } } },
    });
  }

  async findOne(id: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id },
      include: {
        clients: { include: { client: true } },
        _count: { select: { clients: true, sites: true } },
      },
    });
    if (!operator) throw new NotFoundException(`Operator ${id} not found`);
    return operator;
  }

  create(dto: CreateOperatorDto) {
    return this.prisma.operator.create({ data: dto });
  }

  async update(id: string, dto: UpdateOperatorDto) {
    await this.findOne(id);
    return this.prisma.operator.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.operator.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

**Step 3: `apps/api/src/operators/operators.controller.ts`**

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
import { OperatorsService } from './operators.service';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/create-operator.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('operators')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  @Get()
  @RequirePermissions('clients.read')
  findAll(@Query('search') search?: string) {
    return this.operatorsService.findAll(search);
  }

  @Get(':id')
  @RequirePermissions('clients.read')
  findOne(@Param('id') id: string) {
    return this.operatorsService.findOne(id);
  }

  @Post()
  @RequirePermissions('clients.create')
  create(@Body() dto: CreateOperatorDto) {
    return this.operatorsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateOperatorDto) {
    return this.operatorsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  remove(@Param('id') id: string) {
    return this.operatorsService.remove(id);
  }
}
```

**Step 4: `apps/api/src/operators/operators.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { OperatorsService } from './operators.service';
import { OperatorsController } from './operators.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
```

**Commit:**
```bash
git add apps/api/src/operators
git commit -m "feat(api): add OperatorsModule with CRUD and soft delete"
```

---

## Task 4: NestJS InterlocuteursModule

**Files to create:**
- `apps/api/src/interlocuteurs/dto/create-interlocuteur.dto.ts`
- `apps/api/src/interlocuteurs/interlocuteurs.service.ts`
- `apps/api/src/interlocuteurs/interlocuteurs.controller.ts`
- `apps/api/src/interlocuteurs/interlocuteurs.module.ts`

**Step 1: `apps/api/src/interlocuteurs/dto/create-interlocuteur.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const InterlocuteurFonctionEnum = z.enum([
  'chef_projet',
  'charge_affaire',
  'resp_be',
  'autre',
]);

export const CreateInterlocuteurSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  fonction: InterlocuteurFonctionEnum.default('autre'),
});

export class CreateInterlocuteurDto extends createZodDto(CreateInterlocuteurSchema) {}

export const UpdateInterlocuteurSchema = CreateInterlocuteurSchema.partial();
export class UpdateInterlocuteurDto extends createZodDto(UpdateInterlocuteurSchema) {}
```

**Step 2: `apps/api/src/interlocuteurs/interlocuteurs.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInterlocuteurDto,
  UpdateInterlocuteurDto,
} from './dto/create-interlocuteur.dto';

@Injectable()
export class InterlocuteursService {
  constructor(private readonly prisma: PrismaService) {}

  findByClient(clientId: string) {
    return this.prisma.interlocuteur.findMany({
      where: { clientId, isActive: true },
      orderBy: { lastName: 'asc' },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  async findOne(id: string) {
    const interlocuteur = await this.prisma.interlocuteur.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        user: { select: { id: true, email: true } },
      },
    });
    if (!interlocuteur) throw new NotFoundException(`Interlocuteur ${id} not found`);
    return interlocuteur;
  }

  create(dto: CreateInterlocuteurDto) {
    return this.prisma.interlocuteur.create({ data: dto });
  }

  async update(id: string, dto: UpdateInterlocuteurDto) {
    await this.findOne(id);
    return this.prisma.interlocuteur.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.interlocuteur.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

**Step 3: `apps/api/src/interlocuteurs/interlocuteurs.controller.ts`**

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
import { InterlocuteursService } from './interlocuteurs.service';
import {
  CreateInterlocuteurDto,
  UpdateInterlocuteurDto,
} from './dto/create-interlocuteur.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('interlocuteurs')
export class InterlocuteursController {
  constructor(private readonly interlocuteursService: InterlocuteursService) {}

  @Get()
  @RequirePermissions('clients.read')
  findAll(@Query('clientId') clientId: string) {
    return this.interlocuteursService.findByClient(clientId);
  }

  @Get(':id')
  @RequirePermissions('clients.read')
  findOne(@Param('id') id: string) {
    return this.interlocuteursService.findOne(id);
  }

  @Post()
  @RequirePermissions('clients.create')
  create(@Body() dto: CreateInterlocuteurDto) {
    return this.interlocuteursService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateInterlocuteurDto) {
    return this.interlocuteursService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  remove(@Param('id') id: string) {
    return this.interlocuteursService.remove(id);
  }
}
```

**Step 4: `apps/api/src/interlocuteurs/interlocuteurs.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { InterlocuteursService } from './interlocuteurs.service';
import { InterlocuteursController } from './interlocuteurs.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InterlocuteursController],
  providers: [InterlocuteursService],
  exports: [InterlocuteursService],
})
export class InterlocuteursModule {}
```

**Commit:**
```bash
git add apps/api/src/interlocuteurs
git commit -m "feat(api): add InterlocuteursModule with soft delete and user link"
```

---

## Task 5: NestJS TagsModule

**Files to create:**
- `apps/api/src/tags/tags.service.ts`
- `apps/api/src/tags/tags.controller.ts`
- `apps/api/src/tags/tags.module.ts`

**Step 1: `apps/api/src/tags/tags.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { entities: true } } },
    });
  }

  async findOne(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    return tag;
  }

  create(data: { name: string; color?: string }) {
    return this.prisma.tag.create({ data });
  }

  async update(id: string, data: { name?: string; color?: string }) {
    await this.findOne(id);
    return this.prisma.tag.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tag.delete({ where: { id } });
  }
}
```

**Step 2: `apps/api/src/tags/tags.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { TagsService } from './tags.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @RequirePermissions('clients.read')
  findAll() {
    return this.tagsService.findAll();
  }

  @Post()
  @RequirePermissions('tags.create')
  create(@Body() body: { name: string; color?: string }) {
    return this.tagsService.create(body);
  }

  @Patch(':id')
  @RequirePermissions('tags.update')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string },
  ) {
    return this.tagsService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('tags.delete')
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
```

**Step 3: `apps/api/src/tags/tags.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
```

**Commit:**
```bash
git add apps/api/src/tags
git commit -m "feat(api): add TagsModule with CRUD"
```

---

## Task 6: Register all 4 modules in AppModule

**File to modify:** `apps/api/src/app.module.ts`

Add imports for ClientsModule, OperatorsModule, InterlocuteursModule, TagsModule:

```typescript
// Add to imports array in app.module.ts:
import { ClientsModule } from './clients/clients.module';
import { OperatorsModule } from './operators/operators.module';
import { InterlocuteursModule } from './interlocuteurs/interlocuteurs.module';
import { TagsModule } from './tags/tags.module';

// In @Module({ imports: [...] }):
// ClientsModule,
// OperatorsModule,
// InterlocuteursModule,
// TagsModule,
```

**Commit:**
```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register Clients, Operators, Interlocuteurs, Tags modules"
```

---

## Task 7: Next.js API helpers

**Files to create:**
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/clients.ts`

**Step 1: `apps/web/src/lib/api/client.ts`**

```typescript
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error?.message ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
```

**Step 2: `apps/web/src/lib/api/clients.ts`**

```typescript
import { apiRequest } from './client';

export interface Client {
  id: string;
  name: string;
  legalName?: string;
  logoUrl?: string;
  city?: string;
  siret?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  postalCode?: string;
  isActive: boolean;
  operators: Array<{ operator: { id: string; name: string } }>;
  tags: Array<{ tag: { id: string; name: string; color?: string } }>;
  _count: { sites: number; projects: number; interlocuteurs: number };
}

export interface ClientsStats {
  total: number;
  active: number;
  inactive: number;
  withProjects: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListClientsParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  operatorId?: string;
  tagId?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      q.set(key, String(value));
    }
  }
  return q.toString() ? `?${q.toString()}` : '';
}

export const clientsApi = {
  list: (params: ListClientsParams = {}) =>
    apiRequest<PaginatedResponse<Client>>(`/clients${toQuery(params)}`),

  getOne: (id: string) => apiRequest<Client>(`/clients/${id}`),

  getStats: () => apiRequest<ClientsStats>('/clients/stats'),

  create: (body: Record<string, unknown>) =>
    apiRequest<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Client>(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    apiRequest<Client>(`/clients/${id}`, { method: 'DELETE' }),

  updateLogoUrl: (id: string, logoUrl: string) =>
    apiRequest<Client>(`/clients/${id}/logo-url`, {
      method: 'PATCH',
      body: JSON.stringify({ logoUrl }),
    }),
};
```

**Commit:**
```bash
git add apps/web/src/lib/api
git commit -m "feat(web): add apiRequest helper and clientsApi typed client"
```

---

## Task 8: useDebounce hook

**File to create:** `apps/web/src/hooks/use-debounce.ts`

```typescript
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

**Commit:**
```bash
git add apps/web/src/hooks/use-debounce.ts
git commit -m "feat(web): add useDebounce hook"
```

---

## Task 9: Next.js /clients page

**Files to create:**
- `apps/web/src/app/(app)/clients/page.tsx`
- `apps/web/src/app/(app)/clients/clients-table.tsx`
- `apps/web/src/app/(app)/clients/client-form-dialog.tsx`

**Step 1: `apps/web/src/app/(app)/clients/client-form-dialog.tsx`**

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { clientsApi, Client } from '@/lib/api/clients';

const formSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  legalName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: ClientFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!client;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client?.name ?? '',
      legalName: client?.legalName ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      addressLine1: client?.addressLine1 ?? '',
      postalCode: client?.postalCode ?? '',
      city: client?.city ?? '',
      siret: client?.siret ?? '',
      vatNumber: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? clientsApi.update(client!.id, values)
        : clientsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le client' : 'Nouveau client'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nom commercial" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison sociale</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code postal</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="siret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SIRET</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vatNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° TVA</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
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

**Step 2: `apps/web/src/app/(app)/clients/clients-table.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { MoreHorizontal, Plus } from 'lucide-react';
import { clientsApi, Client, ListClientsParams } from '@/lib/api/clients';
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
import { ClientFormDialog } from './client-form-dialog';

function StatsBar({ stats }: { stats: { total: number; active: number; inactive: number; withProjects: number } }) {
  const items = [
    { label: 'Total', value: stats.total },
    { label: 'Actifs', value: stats.active },
    { label: 'Inactifs', value: stats.inactive },
    { label: 'Avec projets', value: stats.withProjects },
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

export function ClientsTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | undefined>();
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const params: ListClientsParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  };

  const { data: stats } = useQuery({
    queryKey: ['clients-stats'],
    queryFn: () => clientsApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['clients', params],
    queryFn: () => clientsApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
    },
  });

  return (
    <div>
      {stats && <StatsBar stats={stats} />}

      <div className="flex items-center justify-between mb-4">
        <Input
          placeholder="Rechercher (nom, ville, SIRET...)"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <Button onClick={() => { setEditClient(undefined); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Opérateurs</TableHead>
              <TableHead>Sites</TableHead>
              <TableHead>Projets</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Tags</TableHead>
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
            {data?.data.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {client.logoUrl ? (
                      <img src={client.logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-bold">
                        {client.name[0]}
                      </div>
                    )}
                    <div>
                      <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                        {client.name}
                      </Link>
                      {client.legalName && (
                        <p className="text-xs text-muted-foreground">{client.legalName}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{client.city ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {client.operators.map(({ operator }) => (
                      <Badge key={operator.id} variant="outline" className="text-xs">
                        {operator.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{client._count.sites}</TableCell>
                <TableCell>{client._count.projects}</TableCell>
                <TableCell>{client._count.interlocuteurs}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {client.tags.map(({ tag }) => (
                      <Badge
                        key={tag.id}
                        className="text-xs"
                        style={tag.color ? { backgroundColor: tag.color, color: '#fff' } : {}}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={client.isActive ? 'default' : 'secondary'}>
                    {client.isActive ? 'Actif' : 'Inactif'}
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
                        <Link href={`/clients/${client.id}`}>Voir le détail</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditClient(client); setDialogOpen(true); }}>
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(client.id)}
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editClient}
      />
    </div>
  );
}
```

**Step 3: `apps/web/src/app/(app)/clients/page.tsx`**

```typescript
import { ClientsTable } from './clients-table';

export const metadata = { title: 'Clients — ExeTeam' };

export default function ClientsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-muted-foreground">Gestion du portefeuille clients</p>
      </div>
      <ClientsTable />
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/clients
git commit -m "feat(web): add /clients page with table, stats bar, and create/edit dialog"
```

---

## Task 10: Next.js /clients/[id] detail page

**Files to create:**
- `apps/web/src/app/(app)/clients/[id]/page.tsx`
- `apps/web/src/app/(app)/clients/[id]/client-detail.tsx`
- `apps/web/src/app/(app)/clients/[id]/tabs/interlocuteurs-tab.tsx`
- `apps/web/src/app/(app)/clients/[id]/tabs/interlocuteur-form-dialog.tsx`
- `apps/web/src/app/(app)/clients/[id]/tabs/sites-tab.tsx`

**Step 1: `apps/web/src/app/(app)/clients/[id]/tabs/interlocuteur-form-dialog.tsx`**

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { apiRequest } from '@/lib/api/client';

const fonctionOptions = [
  { value: 'chef_projet', label: 'Chef de projet' },
  { value: 'charge_affaire', label: "Chargé d'affaire" },
  { value: 'resp_be', label: 'Responsable BE' },
  { value: 'autre', label: 'Autre' },
];

const formSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  fonction: z.enum(['chef_projet', 'charge_affaire', 'resp_be', 'autre']),
});

type FormValues = z.infer<typeof formSchema>;

interface InterlocuteurFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  interlocuteur?: { id: string; firstName: string; lastName: string; email?: string; phone?: string; fonction: string };
}

export function InterlocuteurFormDialog({
  open,
  onOpenChange,
  clientId,
  interlocuteur,
}: InterlocuteurFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!interlocuteur;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: interlocuteur?.firstName ?? '',
      lastName: interlocuteur?.lastName ?? '',
      email: interlocuteur?.email ?? '',
      phone: interlocuteur?.phone ?? '',
      fonction: (interlocuteur?.fonction as FormValues['fonction']) ?? 'autre',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? apiRequest(`/interlocuteurs/${interlocuteur!.id}`, { method: 'PATCH', body: JSON.stringify(values) })
        : apiRequest('/interlocuteurs', { method: 'POST', body: JSON.stringify({ ...values, clientId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le contact' : 'Nouveau contact'}
          </DialogTitle>
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
            <FormField control={form.control} name="fonction" render={({ field }) => (
              <FormItem>
                <FormLabel>Fonction</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {fonctionOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
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

**Step 2: `apps/web/src/app/(app)/clients/[id]/tabs/interlocuteurs-tab.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiRequest } from '@/lib/api/client';
import { InterlocuteurFormDialog } from './interlocuteur-form-dialog';

interface Interlocuteur {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  fonction: string;
  user?: { id: string; email: string };
}

const fonctionLabels: Record<string, string> = {
  chef_projet: 'Chef de projet',
  charge_affaire: "Chargé d'affaire",
  resp_be: 'Responsable BE',
  autre: 'Autre',
};

export function InterlocuteursTab({
  clientId,
  interlocuteurs,
}: {
  clientId: string;
  interlocuteurs: Interlocuteur[];
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Interlocuteur | undefined>();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/interlocuteurs/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', clientId] }),
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditItem(undefined); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un contact
        </Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Fonction</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Compte</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {interlocuteurs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucun contact
                </TableCell>
              </TableRow>
            )}
            {interlocuteurs.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.firstName} {i.lastName}</TableCell>
                <TableCell>
                  <Badge variant="outline">{fonctionLabels[i.fonction] ?? i.fonction}</Badge>
                </TableCell>
                <TableCell>{i.email ?? '—'}</TableCell>
                <TableCell>{i.phone ?? '—'}</TableCell>
                <TableCell>
                  {i.user ? (
                    <Badge variant="default" className="bg-green-500">Compte actif</Badge>
                  ) : (
                    <Badge variant="secondary">Aucun compte</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditItem(i); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(i.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <InterlocuteurFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        interlocuteur={editItem}
      />
    </div>
  );
}
```

**Step 3: `apps/web/src/app/(app)/clients/[id]/tabs/sites-tab.tsx`**

```typescript
'use client';

import Link from 'next/link';
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
import { ExternalLink } from 'lucide-react';

interface Site {
  id: string;
  reference: string;
  name: string;
  commune?: string;
  typologie?: { name: string };
  isActive: boolean;
  _count: { tasks: number };
}

export function SitesTab({ clientId, sites }: { clientId: string; sites: Site[] }) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="outline" asChild>
          <Link href={`/sites?clientId=${clientId}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Voir tous les sites
          </Link>
        </Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Commune</TableHead>
              <TableHead>Typologie</TableHead>
              <TableHead>Tâches</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucun site
                </TableCell>
              </TableRow>
            )}
            {sites.map((site) => (
              <TableRow key={site.id}>
                <TableCell>
                  <Link href={`/sites/${site.id}`} className="font-mono text-sm hover:underline">
                    {site.reference}
                  </Link>
                </TableCell>
                <TableCell>{site.name}</TableCell>
                <TableCell>{site.commune ?? '—'}</TableCell>
                <TableCell>
                  {site.typologie ? (
                    <Badge variant="outline">{site.typologie.name}</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell>{site._count.tasks}</TableCell>
                <TableCell>
                  <Badge variant={site.isActive ? 'default' : 'secondary'}>
                    {site.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

**Step 4: `apps/web/src/app/(app)/clients/[id]/client-detail.tsx`**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clientsApi } from '@/lib/api/clients';
import { InterlocuteursTab } from './tabs/interlocuteurs-tab';
import { SitesTab } from './tabs/sites-tab';

export function ClientDetail({ id }: { id: string }) {
  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsApi.getOne(id),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Chargement...</div>;
  if (!client) return <div className="p-6">Client introuvable</div>;

  return (
    <div className="p-6">
      <div className="flex items-start gap-4 mb-6">
        {client.logoUrl ? (
          <img src={client.logoUrl} alt="" className="h-16 w-16 rounded object-contain border" />
        ) : (
          <div className="h-16 w-16 rounded bg-muted flex items-center justify-center text-2xl font-bold">
            {client.name[0]}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {client.legalName && (
            <p className="text-muted-foreground">{client.legalName}</p>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant={client.isActive ? 'default' : 'secondary'}>
              {client.isActive ? 'Actif' : 'Inactif'}
            </Badge>
            {client.tags?.map(({ tag }) => (
              <Badge
                key={tag.id}
                style={tag.color ? { backgroundColor: tag.color, color: '#fff' } : {}}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="infos">
        <TabsList className="mb-6">
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="interlocuteurs">
            Interlocuteurs ({client._count?.interlocuteurs ?? 0})
          </TabsTrigger>
          <TabsTrigger value="sites">
            Sites ({client._count?.sites ?? 0})
          </TabsTrigger>
          <TabsTrigger value="projets">Projets</TabsTrigger>
          <TabsTrigger value="codes-produits">Codes produits</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
          <TabsTrigger value="champs-perso">Champs perso</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="infos">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Coordonnées</h3>
              {client.email && <p className="text-sm">{client.email}</p>}
              {client.phone && <p className="text-sm">{client.phone}</p>}
              {client.addressLine1 && <p className="text-sm">{client.addressLine1}</p>}
              {(client.postalCode || client.city) && (
                <p className="text-sm">{[client.postalCode, client.city].filter(Boolean).join(' ')}</p>
              )}
            </div>
            <div className="bg-card border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Informations légales</h3>
              {client.siret && (
                <div className="text-sm">
                  <span className="text-muted-foreground">SIRET : </span>
                  <span className="font-mono">{client.siret}</span>
                </div>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Opérateurs : </span>
                {client.operators?.map(({ operator }) => operator.name).join(', ') || '—'}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="interlocuteurs">
          <InterlocuteursTab
            clientId={id}
            interlocuteurs={(client as any).interlocuteurs ?? []}
          />
        </TabsContent>

        <TabsContent value="sites">
          <SitesTab clientId={id} sites={(client as any).sites ?? []} />
        </TabsContent>

        <TabsContent value="projets">
          <div className="text-muted-foreground py-8 text-center">
            Module Projets disponible en Sprint 3
          </div>
        </TabsContent>

        <TabsContent value="codes-produits">
          <div className="text-muted-foreground py-8 text-center">
            Codes produits disponibles en Sprint 2C
          </div>
        </TabsContent>

        <TabsContent value="commercial">
          <div className="text-muted-foreground py-8 text-center">
            Module Commercial disponible en Sprint 3
          </div>
        </TabsContent>

        <TabsContent value="champs-perso">
          <div className="text-muted-foreground py-8 text-center">
            Champs personnalisés disponibles en Sprint 2C
          </div>
        </TabsContent>

        <TabsContent value="historique">
          <div className="text-muted-foreground py-8 text-center">
            Historique disponible en Sprint 4
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 5: `apps/web/src/app/(app)/clients/[id]/page.tsx`**

```typescript
import { ClientDetail } from './client-detail';

interface Props {
  params: { id: string };
}

export const metadata = { title: 'Détail client — ExeTeam' };

export default function ClientDetailPage({ params }: Props) {
  return <ClientDetail id={params.id} />;
}
```

**Commit:**
```bash
git add "apps/web/src/app/(app)/clients/[id]"
git commit -m "feat(web): add /clients/[id] detail page with tabs (infos, interlocuteurs, sites)"
```

---

## Task 11: Next.js /operators page

**Files to create:**
- `apps/web/src/app/(app)/operators/page.tsx`
- `apps/web/src/app/(app)/operators/operators-grid.tsx`

**Step 1: `apps/web/src/app/(app)/operators/operators-grid.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { apiRequest } from '@/lib/api/client';

interface Operator {
  id: string;
  name: string;
  description?: string;
  contact?: string;
  logoUrl?: string;
  isActive: boolean;
  _count: { clients: number };
}

const formSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  contact: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function OperatorFormDialog({
  open,
  onOpenChange,
  operator,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operator?: Operator;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!operator;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: operator?.name ?? '',
      description: operator?.description ?? '',
      contact: operator?.contact ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? apiRequest(`/operators/${operator!.id}`, { method: 'PATCH', body: JSON.stringify(values) })
        : apiRequest('/operators', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l\'opérateur' : 'Nouvel opérateur'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nom *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="contact" render={({ field }) => (
              <FormItem>
                <FormLabel>Contact</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
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

export function OperatorsGrid() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOperator, setEditOperator] = useState<Operator | undefined>();

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ['operators'],
    queryFn: () => apiRequest<Operator[]>('/operators'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/operators/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operators'] }),
  });

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={() => { setEditOperator(undefined); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvel opérateur
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {operators.map((op) => (
          <Card key={op.id}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                {op.logoUrl ? (
                  <img src={op.logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center font-bold">
                    {op.name[0]}
                  </div>
                )}
                <CardTitle className="text-base">{op.name}</CardTitle>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditOperator(op); setDialogOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(op.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {op.description && <p className="text-sm text-muted-foreground">{op.description}</p>}
              {op.contact && <p className="text-sm">{op.contact}</p>}
              <div className="flex items-center gap-2">
                <Badge variant="outline">{op._count.clients} client(s)</Badge>
                <Badge variant={op.isActive ? 'default' : 'secondary'}>
                  {op.isActive ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <OperatorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        operator={editOperator}
      />
    </div>
  );
}
```

**Step 2: `apps/web/src/app/(app)/operators/page.tsx`**

```typescript
import { OperatorsGrid } from './operators-grid';

export const metadata = { title: 'Opérateurs — ExeTeam' };

export default function OperatorsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Opérateurs</h1>
        <p className="text-muted-foreground">Gestion des opérateurs télécom</p>
      </div>
      <OperatorsGrid />
    </div>
  );
}
```

**Commit:**
```bash
git add "apps/web/src/app/(app)/operators"
git commit -m "feat(web): add /operators page with card grid and create/edit/delete dialog"
```

---

## Task 12: TanStack Query provider

**File to create:** `apps/web/src/components/providers/query-provider.tsx`

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

Then wrap the root layout in `apps/web/src/app/layout.tsx`:

```typescript
// Add import:
import { QueryProvider } from '@/components/providers/query-provider';

// Wrap children:
<QueryProvider>{children}</QueryProvider>
```

**Commit:**
```bash
git add apps/web/src/components/providers apps/web/src/app/layout.tsx
git commit -m "feat(web): add TanStack Query provider to root layout"
```

---

## Task 13: Verification + push

```bash
# Build check
pnpm build

# Run API in dev and test endpoints:
# GET  /clients?page=1&limit=10
# POST /clients { "name": "Test Client" }
# GET  /clients/stats
# GET  /operators
# POST /operators { "name": "Orange" }
# GET  /interlocuteurs?clientId=<id>
# GET  /tags

# Push branch
git push -u origin feat/clients
```

**Commit:**
```bash
git add -A && git commit -m "chore(sprint-2a): final verification — clients, operators, interlocuteurs, tags"
```

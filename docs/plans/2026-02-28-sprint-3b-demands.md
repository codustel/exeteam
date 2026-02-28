# ExeTeam Sprint 3B — Demandes Client + Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Demands module with workflow (new → in progress → done), auto-conversion to Task, in-app notifications with badge, and a simplified client portal.

**Architecture:** NestJS DemandsModule + NotificationsModule + PushModule. Demands can be converted to tasks via a dedicated endpoint. Notifications are stored in DB and surfaced via a polling NotificationBell component. Web Push provides real-time browser notifications.

**Tech Stack:** NestJS · Prisma · Zod pipes · TanStack Query · shadcn/ui · react-hook-form + zod · web-push · date-fns

**Prerequisite:** Sprint 2A (clients, interlocuteurs), Sprint 2C (codes produits), Sprint 3A (tasks — for conversion endpoint) complete.

---

## Task 1: Create branch `feat/demands`

```bash
git checkout main && git pull origin main
git checkout -b feat/demands
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/demands branch"
```

---

## Task 2: Install dependencies

```bash
# In apps/api
cd apps/api && pnpm add web-push && pnpm add -D @types/web-push

# In apps/web
cd apps/web && pnpm add date-fns
```

**Commit:**
```bash
git add -A && git commit -m "chore: add web-push and date-fns dependencies"
```

---

## Task 3: NestJS NotificationsModule

**Files to create:**
- `apps/api/src/notifications/dto/create-notification.dto.ts`
- `apps/api/src/notifications/dto/list-notifications.dto.ts`
- `apps/api/src/notifications/notifications.service.ts`
- `apps/api/src/notifications/notifications.controller.ts`
- `apps/api/src/notifications/notifications.module.ts`

**Step 1: `apps/api/src/notifications/dto/create-notification.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  link: z.string().optional(),
});

export class CreateNotificationDto extends createZodDto(CreateNotificationSchema) {}
```

**Step 2: `apps/api/src/notifications/dto/list-notifications.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z.coerce.boolean().optional(),
});

export class ListNotificationsDto extends createZodDto(ListNotificationsSchema) {}
```

**Step 3: `apps/api/src/notifications/notifications.service.ts`**

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string, dto: ListNotificationsDto) {
    const { page, limit, isRead } = dto;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(isRead !== undefined ? { isRead } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    if (notification.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        link: dto.link,
      },
    });
  }

  /**
   * Convenience method for internal use by other NestJS services.
   * Does not require HTTP context.
   */
  async emit(params: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: params,
    });
  }

  /**
   * Emit a notification to every user who has a specific permission.
   */
  async emitToPermission(params: {
    permission: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }) {
    // Find all users who have this permission via their role
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { permission: { name: params.permission } },
      include: { role: true },
    });

    if (rolePermissions.length === 0) return;

    const roleIds = rolePermissions.map((rp) => rp.roleId);

    const users = await this.prisma.user.findMany({
      where: { roleId: { in: roleIds }, deletedAt: null },
      select: { id: true },
    });

    if (users.length === 0) return;

    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
      })),
    });
  }
}
```

**Step 4: `apps/api/src/notifications/notifications.controller.ts`**

```typescript
import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import type { AuthUser } from '../auth/supabase.strategy';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  findAll(@Request() req: { user: AuthUser }, @Query() dto: ListNotificationsDto) {
    return this.notificationsService.findAllForUser(req.user.id, dto);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  getUnreadCount(@Request() req: { user: AuthUser }) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  markRead(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  markAllRead(@Request() req: { user: AuthUser }) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  /**
   * Internal service-to-service endpoint, protected by API key header.
   * No JWT guard — called by internal services or workers.
   */
  @Post()
  createInternal(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: CreateNotificationDto,
  ) {
    const expected = this.config.get<string>('INTERNAL_API_KEY');
    if (!expected || apiKey !== expected) {
      throw new ForbiddenException('Invalid API key');
    }
    return this.notificationsService.create(dto);
  }
}
```

**Step 5: `apps/api/src/notifications/notifications.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

**Commit:**
```bash
git add apps/api/src/notifications && git commit -m "feat(api): add NotificationsModule with service, controller, DTOs"
```

---

## Task 4: NestJS PushModule

**Files to create:**
- `apps/api/src/push/push.service.ts`
- `apps/api/src/push/push.controller.ts`
- `apps/api/src/push/push.module.ts`

**Step 1: `apps/api/src/push/push.service.ts`**

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredSubscription {
  userId: string;
  subscription: PushSubscriptionData;
  subscribedAt: string;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  /**
   * In-memory store for push subscriptions.
   * In production, migrate to a dedicated DB table.
   */
  private subscriptions: Map<string, StoredSubscription[]> = new Map();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    let publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    let privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not found in environment. Generating ephemeral keys for development. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in production.',
      );
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      this.logger.log(`Generated VAPID public key: ${publicKey}`);
    }

    webpush.setVapidDetails(
      'mailto:admin@exeteam.fr',
      publicKey,
      privateKey,
    );
  }

  getPublicKey(): string {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
  }

  subscribe(userId: string, subscription: PushSubscriptionData) {
    const existing = this.subscriptions.get(userId) ?? [];
    // Avoid duplicate endpoints
    const filtered = existing.filter((s) => s.subscription.endpoint !== subscription.endpoint);
    filtered.push({ userId, subscription, subscribedAt: new Date().toISOString() });
    this.subscriptions.set(userId, filtered);
    return { success: true };
  }

  unsubscribe(userId: string, endpoint: string) {
    const existing = this.subscriptions.get(userId) ?? [];
    this.subscriptions.set(
      userId,
      existing.filter((s) => s.subscription.endpoint !== endpoint),
    );
    return { success: true };
  }

  async sendToUser(userId: string, payload: { title: string; body?: string; link?: string }) {
    const userSubs = this.subscriptions.get(userId) ?? [];
    const results = await Promise.allSettled(
      userSubs.map((stored) =>
        webpush.sendNotification(
          stored.subscription as webpush.PushSubscription,
          JSON.stringify(payload),
        ),
      ),
    );

    // Remove expired subscriptions (410 Gone)
    const toRemove: string[] = [];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const err = result.reason as { statusCode?: number };
        if (err.statusCode === 410) {
          toRemove.push(userSubs[idx].subscription.endpoint);
        }
      }
    });

    if (toRemove.length > 0) {
      const remaining = (this.subscriptions.get(userId) ?? []).filter(
        (s) => !toRemove.includes(s.subscription.endpoint),
      );
      this.subscriptions.set(userId, remaining);
    }

    return { sent: results.filter((r) => r.status === 'fulfilled').length };
  }
}
```

**Step 2: `apps/api/src/push/push.controller.ts`**

```typescript
import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PushService, PushSubscriptionData } from './push.service';
import type { AuthUser } from '../auth/supabase.strategy';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('public-key')
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(
    @Request() req: { user: AuthUser },
    @Body() body: { subscription: PushSubscriptionData },
  ) {
    return this.pushService.subscribe(req.user.id, body.subscription);
  }

  @Post('unsubscribe')
  @UseGuards(JwtAuthGuard)
  unsubscribe(
    @Request() req: { user: AuthUser },
    @Body() body: { endpoint: string },
  ) {
    return this.pushService.unsubscribe(req.user.id, body.endpoint);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  sendToSelf(
    @Request() req: { user: AuthUser },
    @Body() body: { title: string; body?: string; link?: string },
  ) {
    return this.pushService.sendToUser(req.user.id, body);
  }
}
```

**Step 3: `apps/api/src/push/push.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
```

**Commit:**
```bash
git add apps/api/src/push && git commit -m "feat(api): add PushModule with VAPID web-push skeleton"
```

---

## Task 5: NestJS DemandsModule

**Files to create:**
- `apps/api/src/demands/dto/create-demand.dto.ts`
- `apps/api/src/demands/dto/update-demand.dto.ts`
- `apps/api/src/demands/dto/list-demands.dto.ts`
- `apps/api/src/demands/demands.service.ts`
- `apps/api/src/demands/demands.controller.ts`
- `apps/api/src/demands/demands.module.ts`

**Step 1: `apps/api/src/demands/dto/create-demand.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DemandStatusValues = ['nouvelle', 'en_cours', 'terminee', 'annulee'] as const;
export const DemandPriorityValues = ['basse', 'normale', 'haute', 'urgente'] as const;

export const CreateDemandSchema = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid(),
  codeProduitId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  demandeurId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  dataLink: z.string().url().optional().or(z.literal('')),
  status: z.enum(DemandStatusValues).default('nouvelle'),
  priority: z.enum(DemandPriorityValues).default('normale'),
  requestedAt: z.coerce.date().optional(),
  desiredDelivery: z.coerce.date().optional(),
});

export class CreateDemandDto extends createZodDto(CreateDemandSchema) {}
```

**Step 2: `apps/api/src/demands/dto/update-demand.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { CreateDemandSchema } from './create-demand.dto';

export const UpdateDemandSchema = CreateDemandSchema.partial();

export class UpdateDemandDto extends createZodDto(UpdateDemandSchema) {}
```

**Step 3: `apps/api/src/demands/dto/list-demands.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DemandStatusValues, DemandPriorityValues } from './create-demand.dto';

export const ListDemandsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  status: z.enum(DemandStatusValues).optional(),
  priority: z.enum(DemandPriorityValues).optional(),
  employeeId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export class ListDemandsDto extends createZodDto(ListDemandsSchema) {}
```

**Step 4: `apps/api/src/demands/demands.service.ts`**

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDemandDto } from './dto/create-demand.dto';
import { UpdateDemandDto } from './dto/update-demand.dto';
import { ListDemandsDto } from './dto/list-demands.dto';
import { format } from 'date-fns';

@Injectable()
export class DemandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async generateReference(): Promise<string> {
    const today = format(new Date(), 'yyyyMMdd');
    const prefix = `DEM-${today}-`;

    const count = await this.prisma.demand.count({
      where: {
        reference: { startsWith: prefix },
      },
    });

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private async generateTaskReference(): Promise<string> {
    const today = format(new Date(), 'yyyyMMdd');
    const prefix = `TSK-${today}-`;

    const count = await this.prisma.task.count({
      where: {
        reference: { startsWith: prefix },
      },
    });

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  async findAll(dto: ListDemandsDto) {
    const { page, limit, search, clientId, projectId, siteId, status, priority, employeeId, dateFrom, dateTo } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(employeeId ? { employeeId } : {}),
    };

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where['requestedAt'] = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.demand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, reference: true } },
          site: { select: { id: true, name: true } },
          demandeur: { select: { id: true, firstName: true, lastName: true, email: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          codeProduit: { select: { id: true, code: true, label: true } },
          task: { select: { id: true, reference: true, title: true, status: true } },
        },
      }),
      this.prisma.demand.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [nouvelles, enCours, termineesThisMonth, aConvertir] = await Promise.all([
      this.prisma.demand.count({ where: { deletedAt: null, status: 'nouvelle' } }),
      this.prisma.demand.count({ where: { deletedAt: null, status: 'en_cours' } }),
      this.prisma.demand.count({
        where: {
          deletedAt: null,
          status: 'terminee',
          updatedAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      this.prisma.demand.count({
        where: {
          deletedAt: null,
          status: { in: ['nouvelle', 'en_cours'] },
          task: null,
        },
      }),
    ]);

    return { nouvelles, enCours, termineesThisMonth, aConvertir };
  }

  async findOne(id: string) {
    const demand = await this.prisma.demand.findUnique({
      where: { id, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        project: { select: { id: true, name: true, reference: true } },
        site: { select: { id: true, name: true, address: true } },
        demandeur: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        employee: { select: { id: true, firstName: true, lastName: true, email: true } },
        codeProduit: { select: { id: true, code: true, label: true } },
        createdBy: { select: { id: true, email: true } },
        task: {
          select: {
            id: true,
            reference: true,
            title: true,
            status: true,
            priority: true,
            plannedEndDate: true,
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!demand) throw new NotFoundException(`Demand ${id} not found`);
    return demand;
  }

  async create(dto: CreateDemandDto, createdById: string) {
    const reference = await this.generateReference();

    const demand = await this.prisma.demand.create({
      data: {
        reference,
        projectId: dto.projectId,
        clientId: dto.clientId,
        codeProduitId: dto.codeProduitId,
        siteId: dto.siteId,
        demandeurId: dto.demandeurId,
        employeeId: dto.employeeId,
        createdById,
        title: dto.title,
        description: dto.description,
        dataLink: dto.dataLink || null,
        status: dto.status ?? 'nouvelle',
        priority: dto.priority ?? 'normale',
        requestedAt: dto.requestedAt ?? new Date(),
        desiredDelivery: dto.desiredDelivery,
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // Notify all users with demands:manage permission
    await this.notifications.emitToPermission({
      permission: 'demands.manage',
      type: 'demand_new',
      title: 'Nouvelle demande client',
      body: `${demand.reference} - ${demand.title}`,
      link: `/demands/${demand.id}`,
    });

    return demand;
  }

  async update(id: string, dto: UpdateDemandDto) {
    await this.findOne(id);

    return this.prisma.demand.update({
      where: { id },
      data: {
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
        ...(dto.codeProduitId !== undefined ? { codeProduitId: dto.codeProduitId } : {}),
        ...(dto.siteId !== undefined ? { siteId: dto.siteId } : {}),
        ...(dto.demandeurId !== undefined ? { demandeurId: dto.demandeurId } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.dataLink !== undefined ? { dataLink: dto.dataLink || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.requestedAt !== undefined ? { requestedAt: dto.requestedAt } : {}),
        ...(dto.desiredDelivery !== undefined ? { desiredDelivery: dto.desiredDelivery } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        demandeur: { select: { id: true, firstName: true, lastName: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.demand.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async convertToTask(id: string) {
    const demand = await this.findOne(id);

    if (demand.status === 'terminee' || demand.status === 'annulee') {
      throw new BadRequestException(
        `Cannot convert a demand with status "${demand.status}" to a task.`,
      );
    }

    if (demand.task) {
      throw new BadRequestException(
        `Demand ${demand.reference} already has a linked task (${demand.task.reference}).`,
      );
    }

    const taskReference = await this.generateTaskReference();

    const task = await this.prisma.$transaction(async (tx) => {
      const newTask = await tx.task.create({
        data: {
          reference: taskReference,
          projectId: demand.projectId,
          codeProduitId: demand.codeProduitId!,
          siteId: demand.siteId,
          employeeId: demand.employeeId,
          title: demand.title,
          description: demand.description,
          demandId: demand.id,
          dateReception: demand.requestedAt,
          plannedEndDate: demand.desiredDelivery,
          status: 'a_traiter',
          priority: demand.priority,
        },
        include: {
          project: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await tx.demand.update({
        where: { id: demand.id },
        data: { status: 'en_cours' },
      });

      return newTask;
    });

    // Notify assigned employee if present
    if (demand.employeeId) {
      // Find the user account linked to this employee
      const employeeUser = await this.prisma.user.findFirst({
        where: { employeeId: demand.employeeId, deletedAt: null },
        select: { id: true },
      });

      if (employeeUser) {
        await this.notifications.emit({
          userId: employeeUser.id,
          type: 'task_assigned',
          title: 'Nouvelle tâche assignée',
          body: task.title,
          link: `/tasks/${task.id}`,
        });
      }
    }

    return task;
  }
}
```

**Step 5: `apps/api/src/demands/demands.controller.ts`**

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
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { DemandsService } from './demands.service';
import { CreateDemandDto } from './dto/create-demand.dto';
import { UpdateDemandDto } from './dto/update-demand.dto';
import { ListDemandsDto } from './dto/list-demands.dto';
import type { AuthUser } from '../auth/supabase.strategy';

@Controller('demands')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DemandsController {
  constructor(private readonly demandsService: DemandsService) {}

  @Get('stats')
  @RequirePermissions('demands.read')
  getStats() {
    return this.demandsService.getStats();
  }

  @Get()
  @RequirePermissions('demands.read')
  findAll(@Query() dto: ListDemandsDto) {
    return this.demandsService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('demands.read')
  findOne(@Param('id') id: string) {
    return this.demandsService.findOne(id);
  }

  @Post()
  @RequirePermissions('demands.create')
  create(@Body() dto: CreateDemandDto, @Request() req: { user: AuthUser }) {
    return this.demandsService.create(dto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions('demands.update')
  update(@Param('id') id: string, @Body() dto: UpdateDemandDto) {
    return this.demandsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('demands.delete')
  remove(@Param('id') id: string) {
    return this.demandsService.remove(id);
  }

  @Post(':id/convert-to-task')
  @RequirePermissions('demands.update')
  convertToTask(@Param('id') id: string) {
    return this.demandsService.convertToTask(id);
  }
}
```

**Step 6: `apps/api/src/demands/demands.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { DemandsController } from './demands.controller';
import { DemandsService } from './demands.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [DemandsController],
  providers: [DemandsService],
  exports: [DemandsService],
})
export class DemandsModule {}
```

**Commit:**
```bash
git add apps/api/src/demands && git commit -m "feat(api): add DemandsModule with CRUD, reference generation, and task conversion"
```

---

## Task 6: Register modules in AppModule

**File to edit: `apps/api/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { SitesModule } from './sites/sites.module';
import { EmployeesModule } from './employees/employees.module';
import { LeavesModule } from './leaves/leaves.module';
import { PublicHolidaysModule } from './public-holidays/public-holidays.module';
import { CodesProduitsModule } from './codes-produits/codes-produits.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { DemandsModule } from './demands/demands.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushModule } from './push/push.module';

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
    AuthModule,
    UsersModule,
    ClientsModule,
    SitesModule,
    EmployeesModule,
    LeavesModule,
    PublicHolidaysModule,
    CodesProduitsModule,
    CustomFieldsModule,
    DemandsModule,
    NotificationsModule,
    PushModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**Commit:**
```bash
git add apps/api/src/app.module.ts && git commit -m "feat(api): register DemandsModule, NotificationsModule, PushModule in AppModule"
```

---

## Task 7: Next.js API client helpers

**Files to create:**
- `apps/web/src/lib/api/demands.ts`
- `apps/web/src/lib/api/notifications.ts`

**Step 1: `apps/web/src/lib/api/demands.ts`**

```typescript
import { apiRequest } from './client';

export type DemandStatus = 'nouvelle' | 'en_cours' | 'terminee' | 'annulee';
export type DemandPriority = 'basse' | 'normale' | 'haute' | 'urgente';

export interface DemandListItem {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  dataLink: string | null;
  status: DemandStatus;
  priority: DemandPriority;
  requestedAt: string;
  desiredDelivery: string | null;
  createdAt: string;
  client: { id: string; name: string };
  project: { id: string; name: string; reference: string };
  site: { id: string; name: string } | null;
  demandeur: { id: string; firstName: string; lastName: string; email: string } | null;
  employee: { id: string; firstName: string; lastName: string } | null;
  codeProduit: { id: string; code: string; label: string } | null;
  task: { id: string; reference: string; title: string; status: string } | null;
}

export interface DemandDetail extends DemandListItem {
  site: { id: string; name: string; address: string | null } | null;
  demandeur: { id: string; firstName: string; lastName: string; email: string; phone: string | null } | null;
  createdBy: { id: string; email: string };
  task: {
    id: string;
    reference: string;
    title: string;
    status: string;
    priority: string;
    plannedEndDate: string | null;
    employee: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

export interface DemandListResponse {
  data: DemandListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DemandStats {
  nouvelles: number;
  enCours: number;
  termineesThisMonth: number;
  aConvertir: number;
}

export interface CreateDemandPayload {
  projectId: string;
  clientId: string;
  codeProduitId?: string;
  siteId?: string;
  demandeurId?: string;
  employeeId?: string;
  title: string;
  description?: string;
  dataLink?: string;
  status?: DemandStatus;
  priority?: DemandPriority;
  requestedAt?: string;
  desiredDelivery?: string;
}

export type UpdateDemandPayload = Partial<CreateDemandPayload>;

export const demandsApi = {
  list: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<DemandListResponse>(`/demands?${qs}`);
  },

  getOne: (id: string) => apiRequest<DemandDetail>(`/demands/${id}`),

  getStats: () => apiRequest<DemandStats>('/demands/stats'),

  create: (data: CreateDemandPayload) =>
    apiRequest<DemandListItem>('/demands', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateDemandPayload) =>
    apiRequest<DemandListItem>(`/demands/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest(`/demands/${id}`, { method: 'DELETE' }),

  convertToTask: (id: string) =>
    apiRequest<{ id: string; reference: string; title: string }>(`/demands/${id}/convert-to-task`, {
      method: 'POST',
    }),
};
```

**Step 2: `apps/web/src/lib/api/notifications.ts`**

```typescript
import { apiRequest } from './client';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsListResponse {
  data: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationsApi = {
  list: (params: { page?: number; limit?: number; isRead?: boolean } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<NotificationsListResponse>(`/notifications?${qs}`);
  },

  getUnreadCount: () => apiRequest<UnreadCountResponse>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiRequest<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiRequest<{ success: boolean }>('/notifications/read-all', { method: 'PATCH' }),
};
```

**Commit:**
```bash
git add apps/web/src/lib/api/demands.ts apps/web/src/lib/api/notifications.ts && git commit -m "feat(web): add demands and notifications API client helpers"
```

---

## Task 8: NotificationBell component + integrate into Header

**Files to create / edit:**
- `apps/web/src/components/NotificationBell.tsx` (create)
- `apps/web/src/components/layout/header.tsx` (edit)

**Step 1: `apps/web/src/components/NotificationBell.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, BellRing, CheckCheck, ExternalLink, Info, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { notificationsApi, type NotificationItem } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';

const typeIconMap: Record<string, React.ElementType> = {
  demand_new: AlertTriangle,
  task_assigned: CheckCircle,
  message: MessageSquare,
  info: Info,
};

function NotificationIcon({ type }: { type: string }) {
  const Icon = typeIconMap[type] ?? Info;
  return <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: NotificationItem;
  onRead: (id: string) => void;
}) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: fr,
  });

  const content = (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors',
        !notification.isRead && 'bg-orange-50 dark:bg-orange-950/20',
      )}
      onClick={() => !notification.isRead && onRead(notification.id)}
    >
      <div className="mt-0.5">
        <NotificationIcon type={notification.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', !notification.isRead && 'font-semibold')}>{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
      </div>
      {notification.link && <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />}
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} className="block" onClick={() => !notification.isRead && onRead(notification.id)}>
        {content}
      </Link>
    );
  }

  return content;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30_000,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['notifications', 'list', { limit: 10 }],
    queryFn: () => notificationsApi.list({ limit: 10 }),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications = listData?.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center bg-[#FF6600] text-white border-0"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Tout marquer lu
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Chargement...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onRead={(id) => markReadMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2">
              <Link
                href="/notifications"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                Voir toutes les notifications
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Edit `apps/web/src/components/layout/header.tsx`**

Replace the existing Bell button with the NotificationBell component:

```typescript
'use client';

import { Moon, Sun, LogOut, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { logout } from '@/lib/auth/actions';
import { NotificationBell } from '@/components/NotificationBell';

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
        <NotificationBell />
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

**Commit:**
```bash
git add apps/web/src/components/NotificationBell.tsx apps/web/src/components/layout/header.tsx && git commit -m "feat(web): add NotificationBell component with polling badge, integrate into Header"
```

---

## Task 9: Next.js /demands page

**Files to create:**
- `apps/web/src/app/(app)/demands/demand-form-dialog.tsx`
- `apps/web/src/app/(app)/demands/demands-table.tsx`
- `apps/web/src/app/(app)/demands/page.tsx`

**Step 1: `apps/web/src/app/(app)/demands/demand-form-dialog.tsx`**

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { demandsApi, type DemandListItem } from '@/lib/api/demands';
import { clientsApi } from '@/lib/api/clients';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  clientId: z.string().min(1, 'Requis'),
  projectId: z.string().min(1, 'Requis'),
  title: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  dataLink: z.string().optional(),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  status: z.enum(['nouvelle', 'en_cours', 'terminee', 'annulee']).default('nouvelle'),
  desiredDelivery: z.string().optional(),
  siteId: z.string().optional(),
  demandeurId: z.string().optional(),
  employeeId: z.string().optional(),
  codeProduitId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  demandId?: string;
}

export function DemandFormDialog({ open, onOpenChange, defaultValues, demandId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!demandId;

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'list', { limit: 200 }],
    queryFn: () => clientsApi.list({ limit: 200 }),
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'normale',
      status: 'nouvelle',
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        ...data,
        desiredDelivery: data.desiredDelivery || undefined,
        siteId: data.siteId || undefined,
        demandeurId: data.demandeurId || undefined,
        employeeId: data.employeeId || undefined,
        codeProduitId: data.codeProduitId || undefined,
        dataLink: data.dataLink || undefined,
      };
      return isEdit
        ? demandsApi.update(demandId!, payload)
        : demandsApi.create(payload as Parameters<typeof demandsApi.create>[0]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      onOpenChange(false);
      form.reset();
    },
  });

  const clients = clientsData?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la demande' : 'Nouvelle demande'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projet *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ID du projet" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Objet de la demande" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} placeholder="Détails de la demande..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dataLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lien données</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorité</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="basse">Basse</SelectItem>
                        <SelectItem value="normale">Normale</SelectItem>
                        <SelectItem value="haute">Haute</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="nouvelle">Nouvelle</SelectItem>
                        <SelectItem value="en_cours">En cours</SelectItem>
                        <SelectItem value="terminee">Terminée</SelectItem>
                        <SelectItem value="annulee">Annulée</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="desiredDelivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Livraison souhaitée</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigné à (ID employé)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="UUID employé" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                style={{ backgroundColor: '#FF6600' }}
                className="text-white hover:opacity-90"
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Enregistrer' : 'Créer la demande'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: `apps/web/src/app/(app)/demands/demands-table.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus, Search, MoreHorizontal, Eye, Pencil, Repeat2, Trash2,
  ClipboardList, Loader2,
} from 'lucide-react';
import { StatsBar } from '@exeteam/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { demandsApi, type DemandStatus, type DemandPriority } from '@/lib/api/demands';
import { DemandFormDialog } from './demand-form-dialog';

const statusConfig: Record<DemandStatus, { label: string; className: string }> = {
  nouvelle: { label: 'Nouvelle', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_cours: { label: 'En cours', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  terminee: { label: 'Terminée', className: 'bg-green-100 text-green-700 border-green-200' },
  annulee: { label: 'Annulée', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const priorityConfig: Record<DemandPriority, { label: string; className: string }> = {
  basse: { label: 'Basse', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  normale: { label: 'Normale', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  haute: { label: 'Haute', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  urgente: { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200' },
};

export function DemandsTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<DemandStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<DemandPriority | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editDemand, setEditDemand] = useState<{ id: string; values: Record<string, unknown> } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['demands', 'stats'],
    queryFn: () => demandsApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['demands', 'list', { search: debouncedSearch, page, statusFilter, priorityFilter }],
    queryFn: () =>
      demandsApi.list({
        search: debouncedSearch || undefined,
        page,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => demandsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      setDeleteId(null);
    },
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => demandsApi.convertToTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      setConvertingId(null);
    },
    onError: (err: Error) => {
      alert(err.message);
      setConvertingId(null);
    },
  });

  const statsItems = [
    { label: 'Nouvelles', value: stats?.nouvelles ?? '—', icon: ClipboardList },
    { label: 'En cours', value: stats?.enCours ?? '—', icon: ClipboardList },
    { label: 'Terminées ce mois', value: stats?.termineesThisMonth ?? '—', icon: ClipboardList },
    { label: 'À convertir', value: stats?.aConvertir ?? '—', icon: Repeat2 },
  ];

  const demands = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (titre, référence)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v as DemandStatus | 'all'); setPage(1); }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="nouvelle">Nouvelle</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="terminee">Terminée</SelectItem>
              <SelectItem value="annulee">Annulée</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(v) => { setPriorityFilter(v as DemandPriority | 'all'); setPage(1); }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes priorités</SelectItem>
              <SelectItem value="basse">Basse</SelectItem>
              <SelectItem value="normale">Normale</SelectItem>
              <SelectItem value="haute">Haute</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          style={{ backgroundColor: '#FF6600' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle demande
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Référence</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Assigné</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Date demande</TableHead>
              <TableHead>Livraison</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : demands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                  Aucune demande trouvée
                </TableCell>
              </TableRow>
            ) : (
              demands.map((demand) => {
                const sc = statusConfig[demand.status];
                const pc = priorityConfig[demand.priority];
                return (
                  <TableRow key={demand.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {demand.reference}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <Link href={`/demands/${demand.id}`} className="hover:underline">
                        {demand.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{demand.client.name}</TableCell>
                    <TableCell className="text-sm">{demand.project.name}</TableCell>
                    <TableCell className="text-sm">{demand.site?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {demand.demandeur
                        ? `${demand.demandeur.firstName} ${demand.demandeur.lastName}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {demand.employee
                        ? `${demand.employee.firstName} ${demand.employee.lastName}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={pc.className}>{pc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(demand.requestedAt), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {demand.desiredDelivery
                        ? format(new Date(demand.desiredDelivery), 'dd/MM/yyyy', { locale: fr })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/demands/${demand.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setEditDemand({
                                id: demand.id,
                                values: {
                                  clientId: demand.client.id,
                                  projectId: demand.project.id,
                                  title: demand.title,
                                  description: demand.description ?? '',
                                  status: demand.status,
                                  priority: demand.priority,
                                },
                              })
                            }
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          {!demand.task && demand.status !== 'terminee' && demand.status !== 'annulee' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setConvertingId(demand.id);
                                convertMutation.mutate(demand.id);
                              }}
                              disabled={convertingId === demand.id}
                            >
                              {convertingId === demand.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Repeat2 className="h-4 w-4 mr-2" />
                              )}
                              Convertir en tâche
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(demand.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} demande{(data?.total ?? 0) > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Précédent
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <DemandFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit Dialog */}
      {editDemand && (
        <DemandFormDialog
          open={!!editDemand}
          onOpenChange={(o) => !o && setEditDemand(null)}
          demandId={editDemand.id}
          defaultValues={editDemand.values as Record<string, string>}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La demande sera archivée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 3: `apps/web/src/app/(app)/demands/page.tsx`**

```typescript
import { Header } from '@/components/layout/header';
import { DemandsTable } from './demands-table';

export const metadata = { title: 'Demandes client' };

export default function DemandsPage() {
  return (
    <>
      <Header title="Demandes client" />
      <div className="p-6 space-y-6">
        <DemandsTable />
      </div>
    </>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/demands && git commit -m "feat(web): add /demands list page with StatsBar, filters, DataTable, convert-to-task action"
```

---

## Task 10: Next.js /demands/[id] detail page

**Files to create:**
- `apps/web/src/app/(app)/demands/[id]/demand-detail-client.tsx`
- `apps/web/src/app/(app)/demands/[id]/page.tsx`

**Step 1: `apps/web/src/app/(app)/demands/[id]/demand-detail-client.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, Pencil, ExternalLink, Repeat2, CheckCircle2, XCircle,
  Clock, AlertTriangle, Loader2, Bell,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { demandsApi, type DemandStatus, type DemandPriority } from '@/lib/api/demands';
import { notificationsApi } from '@/lib/api/notifications';
import { DemandFormDialog } from '../demand-form-dialog';

const statusConfig: Record<DemandStatus, { label: string; className: string; icon: React.ElementType }> = {
  nouvelle: { label: 'Nouvelle', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: AlertTriangle },
  en_cours: { label: 'En cours', className: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
  terminee: { label: 'Terminée', className: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  annulee: { label: 'Annulée', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: XCircle },
};

const priorityConfig: Record<DemandPriority, { label: string; className: string }> = {
  basse: { label: 'Basse', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  normale: { label: 'Normale', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  haute: { label: 'Haute', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  urgente: { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200' },
};

export function DemandDetailClient({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const { data: demand, isLoading, error } = useQuery({
    queryKey: ['demands', 'detail', id],
    queryFn: () => demandsApi.getOne(id),
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'list', 'demand', id],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    enabled: !!demand,
    select: (data) => ({
      ...data,
      data: data.data.filter((n) => n.link?.includes(id)),
    }),
  });

  const convertMutation = useMutation({
    mutationFn: () => demandsApi.convertToTask(id),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      router.push(`/tasks/${task.id}`);
    },
    onError: (err: Error) => alert(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !demand) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Demande introuvable.</p>
        <Button variant="link" onClick={() => router.back()}>Retour</Button>
      </div>
    );
  }

  const sc = statusConfig[demand.status];
  const pc = priorityConfig[demand.priority];
  const StatusIcon = sc.icon;

  const notifications = notificationsData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 mb-1">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {demand.reference}
            </span>
            <h1 className="text-2xl font-bold">{demand.title}</h1>
            <Badge variant="outline" className={`${sc.className} flex items-center gap-1`}>
              <StatusIcon className="h-3 w-3" />
              {sc.label}
            </Badge>
            <Badge variant="outline" className={pc.className}>{pc.label}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: 2/3 */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {demand.description ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">{demand.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Aucune description</p>
              )}
            </CardContent>
          </Card>

          {/* Data link */}
          {demand.dataLink && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lien données</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={demand.dataLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {demand.dataLink}
                </a>
              </CardContent>
            </Card>
          )}

          {/* Linked task */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tâche liée</CardTitle>
            </CardHeader>
            <CardContent>
              {demand.task ? (
                <Link href={`/tasks/${demand.task.id}`} className="block hover:bg-accent rounded-lg p-3 border transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{demand.task.reference}</p>
                      <p className="font-medium mt-0.5">{demand.task.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {demand.task.plannedEndDate && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(demand.task.plannedEndDate), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">{demand.task.status}</Badge>
                    </div>
                  </div>
                  {demand.task.employee && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Assigné à {demand.task.employee.firstName} {demand.task.employee.lastName}
                    </p>
                  )}
                </Link>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">Aucune tâche liée</p>
                  {demand.status !== 'terminee' && demand.status !== 'annulee' && (
                    <Button
                      size="sm"
                      onClick={() => convertMutation.mutate()}
                      disabled={convertMutation.isPending}
                      style={{ backgroundColor: '#FF6600' }}
                      className="text-white hover:opacity-90"
                    >
                      {convertMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Repeat2 className="h-4 w-4 mr-2" />
                      )}
                      Convertir en tâche
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications history */}
          {notifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Historique notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(n.createdAt), 'dd/MM HH:mm', { locale: fr })}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar: 1/3 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Client</p>
                <p className="font-medium">{demand.client.name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Projet</p>
                <p className="font-medium">{demand.project.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{demand.project.reference}</p>
              </div>
              {demand.site && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Site</p>
                    <p className="font-medium">{demand.site.name}</p>
                    {demand.site.address && (
                      <p className="text-xs text-muted-foreground">{demand.site.address}</p>
                    )}
                  </div>
                </>
              )}
              {demand.codeProduit && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Code produit</p>
                    <p className="font-medium">{demand.codeProduit.code}</p>
                    <p className="text-xs text-muted-foreground">{demand.codeProduit.label}</p>
                  </div>
                </>
              )}
              {demand.demandeur && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Demandeur</p>
                    <p className="font-medium">{demand.demandeur.firstName} {demand.demandeur.lastName}</p>
                    <p className="text-xs text-muted-foreground">{demand.demandeur.email}</p>
                    {demand.demandeur.phone && (
                      <p className="text-xs text-muted-foreground">{demand.demandeur.phone}</p>
                    )}
                  </div>
                </>
              )}
              {demand.employee && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Assigné à</p>
                    <p className="font-medium">{demand.employee.firstName} {demand.employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{demand.employee.email}</p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Dates</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date demande</span>
                    <span>{format(new Date(demand.requestedAt), 'dd/MM/yyyy', { locale: fr })}</span>
                  </div>
                  {demand.desiredDelivery && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Livraison souhaitée</span>
                      <span>{format(new Date(demand.desiredDelivery), 'dd/MM/yyyy', { locale: fr })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Créée le</span>
                    <span>{format(new Date(demand.createdAt), 'dd/MM/yyyy', { locale: fr })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      {demand && (
        <DemandFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          demandId={demand.id}
          defaultValues={{
            clientId: demand.client.id,
            projectId: demand.project.id,
            title: demand.title,
            description: demand.description ?? '',
            dataLink: demand.dataLink ?? '',
            status: demand.status,
            priority: demand.priority,
            siteId: demand.site?.id ?? '',
            employeeId: demand.employee?.id ?? '',
            demandeurId: demand.demandeur?.id ?? '',
            codeProduitId: demand.codeProduit?.id ?? '',
            desiredDelivery: demand.desiredDelivery
              ? format(new Date(demand.desiredDelivery), 'yyyy-MM-dd')
              : '',
          }}
        />
      )}
    </div>
  );
}
```

**Step 2: `apps/web/src/app/(app)/demands/[id]/page.tsx`**

```typescript
import { Header } from '@/components/layout/header';
import { DemandDetailClient } from './demand-detail-client';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: 'Demande client' };

export default async function DemandDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <Header title="Demande client" />
      <DemandDetailClient id={id} />
    </>
  );
}
```

**Commit:**
```bash
git add apps/web/src/app/\(app\)/demands/\[id\] && git commit -m "feat(web): add /demands/[id] detail page with task conversion, notifications history, sidebar"
```

---

## Task 11: Next.js /portal/demands page (client portal)

**Files to create:**
- `apps/web/src/app/(portal)/layout.tsx`
- `apps/web/src/app/(portal)/demands/portal-demands-client.tsx`
- `apps/web/src/app/(portal)/demands/page.tsx`

**Step 1: `apps/web/src/app/(portal)/layout.tsx`**

This is the portal layout — no sidebar, minimal navigation, accessible only to interlocuteurs.

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-background">
      {/* Portal header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: '#FF6600' }}>
              ET
            </div>
            <span className="font-semibold text-foreground">Espace Client ExeTeam</span>
          </div>
          <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Déconnexion
          </a>
        </div>
      </header>
      {/* Portal content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
```

**Step 2: `apps/web/src/app/(portal)/demands/portal-demands-client.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Loader2, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { demandsApi, type DemandStatus } from '@/lib/api/demands';

const portalSchema = z.object({
  title: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  desiredDelivery: z.string().optional(),
  codeProduitId: z.string().optional(),
  siteId: z.string().optional(),
});

type PortalFormValues = z.infer<typeof portalSchema>;

const statusConfig: Record<DemandStatus, { label: string; className: string }> = {
  nouvelle: { label: 'Nouvelle', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_cours: { label: 'En cours', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  terminee: { label: 'Terminée', className: 'bg-green-100 text-green-700 border-green-200' },
  annulee: { label: 'Annulée', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

interface Props {
  /**
   * The client ID inferred from the logged-in interlocuteur's session.
   * In a real implementation, resolve this server-side from the user's
   * interlocuteurId → clientId and pass it as a prop.
   */
  clientId: string;
  projectId: string;
}

export function PortalDemandsClient({ clientId, projectId }: Props) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'demands', clientId],
    queryFn: () => demandsApi.list({ clientId, limit: 50, page: 1 }),
  });

  const form = useForm<PortalFormValues>({
    resolver: zodResolver(portalSchema),
    defaultValues: {},
  });

  const createMutation = useMutation({
    mutationFn: (values: PortalFormValues) =>
      demandsApi.create({
        clientId,
        projectId,
        title: values.title,
        description: values.description,
        desiredDelivery: values.desiredDelivery,
        codeProduitId: values.codeProduitId || undefined,
        siteId: values.siteId || undefined,
        status: 'nouvelle',
        priority: 'normale',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'demands'] });
      setCreateOpen(false);
      form.reset();
    },
  });

  const demands = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes demandes</h1>
          <p className="text-muted-foreground mt-1">
            Suivez l'avancement de vos demandes et soumettez-en de nouvelles.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          style={{ backgroundColor: '#FF6600' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle demande
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['nouvelle', 'en_cours', 'terminee'] as DemandStatus[]).map((status) => {
          const sc = statusConfig[status];
          const count = demands.filter((d) => d.status === status).length;
          return (
            <div key={status} className="border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Demands table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date demande</TableHead>
              <TableHead>Livraison souhaitée</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : demands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Vous n'avez pas encore de demandes
                </TableCell>
              </TableRow>
            ) : (
              demands.map((demand) => {
                const sc = statusConfig[demand.status];
                return (
                  <TableRow key={demand.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{demand.reference}</span>
                    </TableCell>
                    <TableCell className="font-medium">{demand.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(demand.requestedAt), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {demand.desiredDelivery
                        ? format(new Date(demand.desiredDelivery), 'dd/MM/yyyy', { locale: fr })
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Nouvelle demande</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Objet de la demande" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} placeholder="Décrivez votre demande..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="desiredDelivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Livraison souhaitée</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codeProduitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code produit (ID)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="UUID optionnel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site (ID)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="UUID optionnel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{ backgroundColor: '#FF6600' }}
                  className="text-white hover:opacity-90"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Soumettre la demande
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 3: `apps/web/src/app/(portal)/demands/page.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PortalDemandsClient } from './portal-demands-client';

export const metadata = { title: 'Mes demandes — Espace Client' };

export default async function PortalDemandsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  /**
   * In production: query the NestJS API to resolve
   * the logged-in user's interlocuteurId → clientId + default projectId.
   * For now, we pass placeholder values that will be replaced when the
   * interlocuteur session data is wired up in Sprint 3A.
   */
  const clientId = user.user_metadata?.clientId ?? '';
  const projectId = user.user_metadata?.projectId ?? '';

  if (!clientId || !projectId) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">
          Votre compte n&apos;est pas encore associé à un client.
          Contactez votre administrateur.
        </p>
      </div>
    );
  }

  return <PortalDemandsClient clientId={clientId} projectId={projectId} />;
}
```

**Commit:**
```bash
git add apps/web/src/app/\(portal\) && git commit -m "feat(web): add /portal/demands client portal page with simplified layout and create form"
```

---

## Task 12: Add `deletedAt` field to Demand model (if missing)

Check the Prisma schema. If `deletedAt` is not already on the `Demand` model, add it:

**File to edit: `packages/db/prisma/schema.prisma`**

In the `Demand` model, add before `@@map`:

```prisma
  deletedAt       DateTime?
```

Then run the migration:

```bash
cd packages/db
pnpm prisma migrate dev --name "add_demand_deleted_at"
pnpm prisma generate
```

**Commit:**
```bash
git add packages/db/prisma && git commit -m "feat(db): add deletedAt soft-delete field to Demand model"
```

---

## Task 13: Add `INTERNAL_API_KEY` env variable documentation

Add to `apps/api/.env.example` (create if missing):

```bash
# Internal service-to-service API key for /notifications internal endpoint
INTERNAL_API_KEY=change_me_in_production

# VAPID keys for Web Push (generate with: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

**Commit:**
```bash
git add apps/api/.env.example && git commit -m "chore(api): document INTERNAL_API_KEY and VAPID env vars"
```

---

## Task 14: Final integration checks and commit

Run the following verifications before the final commit:

```bash
# Type-check API
cd apps/api && pnpm tsc --noEmit

# Type-check Web
cd apps/web && pnpm tsc --noEmit

# Run API in dev to verify modules load
cd apps/api && pnpm dev
```

Fix any TypeScript errors surfaced, then create the final commit:

```bash
git add -A && git commit -m "feat: Sprint 3B — Demandes + Notifications + Push complete

- DemandsModule: CRUD, reference DEM-YYYYMMDD-XXXX, convert-to-task endpoint
- NotificationsModule: list, unread-count, mark-read, mark-all-read, internal create
- PushModule: VAPID skeleton, subscribe/unsubscribe/send endpoints
- NotificationBell: polling badge (30s), popover with last 10, mark-read on click
- /demands list: StatsBar KPIs, DataTable, filters, convert action
- /demands/[id]: detail view, linked task card, notifications history
- /portal/demands: clean client portal layout, simplified create form"
```

---

## Summary of files created / edited

### NestJS API (`apps/api/src/`)

| File | Action |
|------|--------|
| `notifications/dto/create-notification.dto.ts` | Create |
| `notifications/dto/list-notifications.dto.ts` | Create |
| `notifications/notifications.service.ts` | Create |
| `notifications/notifications.controller.ts` | Create |
| `notifications/notifications.module.ts` | Create |
| `push/push.service.ts` | Create |
| `push/push.controller.ts` | Create |
| `push/push.module.ts` | Create |
| `demands/dto/create-demand.dto.ts` | Create |
| `demands/dto/update-demand.dto.ts` | Create |
| `demands/dto/list-demands.dto.ts` | Create |
| `demands/demands.service.ts` | Create |
| `demands/demands.controller.ts` | Create |
| `demands/demands.module.ts` | Create |
| `app.module.ts` | Edit — add 3 new modules |

### Next.js Web (`apps/web/src/`)

| File | Action |
|------|--------|
| `lib/api/demands.ts` | Create |
| `lib/api/notifications.ts` | Create |
| `components/NotificationBell.tsx` | Create |
| `components/layout/header.tsx` | Edit — replace Bell with NotificationBell |
| `app/(app)/demands/page.tsx` | Create |
| `app/(app)/demands/demands-table.tsx` | Create |
| `app/(app)/demands/demand-form-dialog.tsx` | Create |
| `app/(app)/demands/[id]/page.tsx` | Create |
| `app/(app)/demands/[id]/demand-detail-client.tsx` | Create |
| `app/(portal)/layout.tsx` | Create |
| `app/(portal)/demands/page.tsx` | Create |
| `app/(portal)/demands/portal-demands-client.tsx` | Create |

### Prisma (`packages/db/`)

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Edit — add `deletedAt` to Demand if missing |

---

## Key business logic recap

### Reference generation
- `DEM-YYYYMMDD-XXXX`: counts demands with same day prefix, pads to 4 digits
- `TSK-YYYYMMDD-XXXX`: same pattern for tasks during conversion
- Both are computed at create time inside a transaction-safe count

### Demand → Task conversion (`POST /demands/:id/convert-to-task`)
1. Validate demand exists + status is not `terminee`/`annulee` + no existing task
2. Create Task with all relevant fields from demand (`projectId`, `codeProduitId`, `siteId`, `employeeId`, `title`, `description`, `demandId`, dates, priority)
3. Update demand status to `en_cours`
4. If `employeeId` is set, find the linked User account and emit a `task_assigned` notification
5. Return the created task (consumer redirects to `/tasks/{task.id}`)

### Notification dispatch on demand creation
`NotificationsService.emitToPermission()` finds all users whose role has the `demands.manage` permission and creates one notification row per user in bulk using `createMany`.

### NotificationBell polling
`useQuery` with `refetchInterval: 30_000` polls `/notifications/unread-count` every 30 seconds. The popover list is only fetched when open (`enabled: open`), keeping network usage minimal.

### Portal route guard
`apps/web/src/app/(portal)/layout.tsx` checks Supabase session server-side. If no session, redirects to `/login`. The `clientId` / `projectId` are resolved from `user.user_metadata` — these should be populated when the interlocuteur account is created (wired up in Sprint 3A's interlocuteur onboarding flow).

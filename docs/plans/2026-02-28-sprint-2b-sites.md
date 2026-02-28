# ExeTeam Sprint 2B — Sites Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the full Sites module — NestJS API + Next.js UI — with support for site typologies, GPS coordinates, paginated listing with filters, and a detail page with an embedded tasks tab.

**Architecture:** NestJS SitesModule exposes REST endpoints with JwtAuthGuard + PermissionsGuard. Next.js pages use TanStack Query + the typed `apiRequest` helper. Site references must be unique per client (enforced at service level with 409 ConflictException).

**Tech Stack:** NestJS · Prisma · Zod pipes · TanStack Query · shadcn/ui · react-hook-form + zod

**Prerequisite:** Sprint 1 complete, all tables in Supabase, Prisma client generated, RBAC guards working. TanStack Query provider in place (from Sprint 2A or independently).

---

## Task 1: Create branch `feat/sites`

```bash
git checkout main && git pull origin main
git checkout -b feat/sites
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/sites branch"
```

---

## Task 2: NestJS SitesModule

**Files to create:**
- `apps/api/src/sites/dto/create-site.dto.ts`
- `apps/api/src/sites/dto/list-sites.dto.ts`
- `apps/api/src/sites/sites.service.ts`
- `apps/api/src/sites/sites.controller.ts`
- `apps/api/src/sites/sites.module.ts`

**Step 1: `apps/api/src/sites/dto/create-site.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateSiteSchema = z.object({
  reference: z.string().min(1),
  name: z.string().min(1),
  clientId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),
  typologieId: z.string().uuid().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  commune: z.string().optional(),
  departement: z.string().optional(),
  country: z.string().default('FR'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  customFieldsData: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
});

export class CreateSiteDto extends createZodDto(CreateSiteSchema) {}

export const UpdateSiteSchema = CreateSiteSchema.partial();
export class UpdateSiteDto extends createZodDto(UpdateSiteSchema) {}
```

**Step 2: `apps/api/src/sites/dto/list-sites.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListSitesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  clientId: z.string().optional(),
  operatorId: z.string().optional(),
  typologieId: z.string().optional(),
  commune: z.string().optional(),
  departement: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export class ListSitesDto extends createZodDto(ListSitesSchema) {}
```

**Step 3: `apps/api/src/sites/sites.service.ts`**

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto, UpdateSiteDto } from './dto/create-site.dto';
import { ListSitesDto } from './dto/list-sites.dto';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListSitesDto) {
    const {
      page,
      limit,
      search,
      clientId,
      operatorId,
      typologieId,
      commune,
      departement,
      isActive,
    } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where['OR'] = [
        { reference: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { commune: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (clientId) where['clientId'] = clientId;
    if (operatorId) where['operatorId'] = operatorId;
    if (typologieId) where['typologieId'] = typologieId;
    if (commune) where['commune'] = { contains: commune, mode: 'insensitive' };
    if (departement) where['departement'] = departement;
    if (isActive !== undefined) where['isActive'] = isActive;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.site.findMany({
        where,
        skip,
        take: limit,
        orderBy: { reference: 'asc' },
        include: {
          client: { select: { id: true, name: true } },
          operator: { select: { id: true, name: true } },
          typologie: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.site.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            customFieldsConfig: true,
          },
        },
        operator: { select: { id: true, name: true } },
        typologie: { select: { id: true, name: true } },
        tasks: {
          where: { isActive: true },
          include: {
            codeProduit: { select: { code: true } },
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { tasks: true, demands: true } },
      },
    });

    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site;
  }

  async create(dto: CreateSiteDto) {
    const existing = await this.prisma.site.findFirst({
      where: { clientId: dto.clientId, reference: dto.reference },
    });

    if (existing) {
      throw new ConflictException(
        `Un site avec la référence "${dto.reference}" existe déjà pour ce client`,
      );
    }

    return this.prisma.site.create({
      data: dto,
      include: {
        client: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        typologie: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateSiteDto) {
    await this.findOne(id);

    if (dto.reference || dto.clientId) {
      const site = await this.prisma.site.findUnique({ where: { id } });
      const checkClientId = dto.clientId ?? site!.clientId;
      const checkReference = dto.reference ?? site!.reference;

      const conflict = await this.prisma.site.findFirst({
        where: {
          clientId: checkClientId,
          reference: checkReference,
          NOT: { id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Un site avec la référence "${checkReference}" existe déjà pour ce client`,
        );
      }
    }

    return this.prisma.site.update({
      where: { id },
      data: dto,
      include: {
        client: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        typologie: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.site.update({ where: { id }, data: { isActive: false } });
  }

  getTypologies() {
    return this.prisma.siteTypology.findMany({ orderBy: { name: 'asc' } });
  }

  async getStats() {
    const [total, active, inactive] = await this.prisma.$transaction([
      this.prisma.site.count(),
      this.prisma.site.count({ where: { isActive: true } }),
      this.prisma.site.count({ where: { isActive: false } }),
    ]);

    const withActiveTasks = await this.prisma.site.count({
      where: { tasks: { some: { status: { notIn: ['terminee', 'livree'] } } } },
    });

    return { total, active, inactive, withActiveTasks };
  }
}
```

**Step 4: `apps/api/src/sites/sites.controller.ts`**

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
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto/create-site.dto';
import { ListSitesDto } from './dto/list-sites.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get('typologies')
  @RequirePermissions('sites.read')
  getTypologies() {
    return this.sitesService.getTypologies();
  }

  @Get('stats')
  @RequirePermissions('sites.read')
  getStats() {
    return this.sitesService.getStats();
  }

  @Get()
  @RequirePermissions('sites.read')
  findAll(@Query() dto: ListSitesDto) {
    return this.sitesService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('sites.read')
  findOne(@Param('id') id: string) {
    return this.sitesService.findOne(id);
  }

  @Post()
  @RequirePermissions('sites.create')
  create(@Body() dto: CreateSiteDto) {
    return this.sitesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('sites.update')
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.sitesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('sites.delete')
  remove(@Param('id') id: string) {
    return this.sitesService.remove(id);
  }
}
```

**Step 5: `apps/api/src/sites/sites.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
```

**Step 6: Register in `apps/api/src/app.module.ts`**

```typescript
// Add import:
import { SitesModule } from './sites/sites.module';

// Add to @Module({ imports: [...] }):
// SitesModule,
```

**Commit:**
```bash
git add apps/api/src/sites apps/api/src/app.module.ts
git commit -m "feat(api): add SitesModule with CRUD, typologies, stats, and uniqueness check"
```

---

## Task 3: Next.js API helper for sites

**File to create:** `apps/web/src/lib/api/sites.ts`

```typescript
import { apiRequest } from './client';

export interface SiteTypology {
  id: string;
  name: string;
}

export interface Site {
  id: string;
  reference: string;
  name: string;
  clientId: string;
  client?: { id: string; name: string };
  operatorId?: string;
  operator?: { id: string; name: string };
  typologieId?: string;
  typologie?: { id: string; name: string };
  address?: string;
  postalCode?: string;
  commune?: string;
  departement?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  _count: { tasks: number };
}

export interface SitesStats {
  total: number;
  active: number;
  inactive: number;
  withActiveTasks: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListSitesParams {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: string;
  operatorId?: string;
  typologieId?: string;
  commune?: string;
  departement?: string;
  isActive?: boolean;
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

export const sitesApi = {
  list: (params: ListSitesParams = {}) =>
    apiRequest<PaginatedResponse<Site>>(`/sites${toQuery(params)}`),

  getOne: (id: string) => apiRequest<Site>(`/sites/${id}`),

  getStats: () => apiRequest<SitesStats>('/sites/stats'),

  getTypologies: () => apiRequest<SiteTypology[]>('/sites/typologies'),

  create: (body: Record<string, unknown>) =>
    apiRequest<Site>('/sites', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Site>(`/sites/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    apiRequest<Site>(`/sites/${id}`, { method: 'DELETE' }),
};
```

**Commit:**
```bash
git add apps/web/src/lib/api/sites.ts
git commit -m "feat(web): add sitesApi typed client"
```

---

## Task 4: Next.js /sites page

**Files to create:**
- `apps/web/src/app/(app)/sites/site-form-dialog.tsx`
- `apps/web/src/app/(app)/sites/sites-table.tsx`
- `apps/web/src/app/(app)/sites/page.tsx`

**Step 1: `apps/web/src/app/(app)/sites/site-form-dialog.tsx`**

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { sitesApi, Site } from '@/lib/api/sites';
import { clientsApi } from '@/lib/api/clients';

const formSchema = z.object({
  reference: z.string().min(1, 'Référence requise'),
  name: z.string().min(1, 'Nom requis'),
  clientId: z.string().uuid('Client requis'),
  typologieId: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  commune: z.string().optional(),
  departement: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SiteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: Site;
  defaultClientId?: string;
}

export function SiteFormDialog({
  open,
  onOpenChange,
  site,
  defaultClientId,
}: SiteFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!site;

  const { data: clients } = useQuery({
    queryKey: ['clients', { limit: 100 }],
    queryFn: () => clientsApi.list({ limit: 100 }),
  });

  const { data: typologies } = useQuery({
    queryKey: ['site-typologies'],
    queryFn: () => sitesApi.getTypologies(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reference: site?.reference ?? '',
      name: site?.name ?? '',
      clientId: site?.clientId ?? defaultClientId ?? '',
      typologieId: site?.typologieId ?? '',
      address: site?.address ?? '',
      postalCode: site?.postalCode ?? '',
      commune: site?.commune ?? '',
      departement: site?.departement ?? '',
      latitude: site?.latitude,
      longitude: site?.longitude,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body = { ...values };
      if (!body.typologieId) delete (body as Partial<FormValues>).typologieId;
      return isEdit
        ? sitesApi.update(site!.id, body)
        : sitesApi.create(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['sites-stats'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le site' : 'Nouveau site'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Référence *</FormLabel>
                  <FormControl><Input {...field} className="font-mono" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="clientId" render={({ field }) => (
              <FormItem>
                <FormLabel>Client *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients?.data.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="typologieId" render={({ field }) => (
              <FormItem>
                <FormLabel>Typologie</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une typologie" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {typologies?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="postalCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code postal</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="commune" render={({ field }) => (
                <FormItem>
                  <FormLabel>Commune</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="departement" render={({ field }) => (
                <FormItem>
                  <FormLabel>Département</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="latitude" render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl><Input {...field} type="number" step="any" placeholder="48.8566" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="longitude" render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <FormControl><Input {...field} type="number" step="any" placeholder="2.3522" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

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

**Step 2: `apps/web/src/app/(app)/sites/sites-table.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { MoreHorizontal, Plus, MapPin } from 'lucide-react';
import { sitesApi, Site, ListSitesParams } from '@/lib/api/sites';
import { sitesApi as api } from '@/lib/api/sites';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SiteFormDialog } from './site-form-dialog';

function StatsBar({ stats }: {
  stats: { total: number; active: number; inactive: number; withActiveTasks: number }
}) {
  const items = [
    { label: 'Sites actifs', value: stats.active },
    { label: 'Tâches en cours', value: stats.withActiveTasks },
    { label: 'Inactifs', value: stats.inactive },
    { label: 'Total', value: stats.total },
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

export function SitesTable({ defaultClientId }: { defaultClientId?: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typologieId, setTypologieId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSite, setEditSite] = useState<Site | undefined>();
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const params: ListSitesParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    clientId: defaultClientId,
    typologieId: typologieId || undefined,
  };

  const { data: stats } = useQuery({
    queryKey: ['sites-stats'],
    queryFn: () => sitesApi.getStats(),
  });

  const { data: typologies } = useQuery({
    queryKey: ['site-typologies'],
    queryFn: () => sitesApi.getTypologies(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sites', params],
    queryFn: () => sitesApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sitesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['sites-stats'] });
    },
  });

  return (
    <div>
      {stats && <StatsBar stats={stats} />}

      <div className="flex items-center gap-4 mb-4">
        <Input
          placeholder="Référence, nom, commune..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <Select value={typologieId} onValueChange={(v) => { setTypologieId(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Toutes typologies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes typologies</SelectItem>
            {typologies?.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={() => { setEditSite(undefined); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau site
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Commune</TableHead>
              <TableHead>Dépt</TableHead>
              <TableHead>Opérateur</TableHead>
              <TableHead>Typologie</TableHead>
              <TableHead>Tâches</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((site) => (
              <TableRow key={site.id}>
                <TableCell>
                  <Link href={`/sites/${site.id}`} className="font-mono text-sm font-medium hover:underline">
                    {site.reference}
                  </Link>
                </TableCell>
                <TableCell>{site.name}</TableCell>
                <TableCell>
                  {site.client ? (
                    <Link href={`/clients/${site.client.id}`} className="hover:underline text-sm">
                      {site.client.name}
                    </Link>
                  ) : '—'}
                </TableCell>
                <TableCell>{site.commune ?? '—'}</TableCell>
                <TableCell>{site.departement ?? '—'}</TableCell>
                <TableCell>{site.operator?.name ?? '—'}</TableCell>
                <TableCell>
                  {site.typologie ? (
                    <Badge variant="outline">{site.typologie.name}</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell>{site._count.tasks}</TableCell>
                <TableCell>
                  {site.latitude && site.longitude ? (
                    <Badge className="bg-green-500 text-white text-xs">
                      <MapPin className="mr-1 h-3 w-3" />
                      GPS
                    </Badge>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={site.isActive ? 'default' : 'secondary'}>
                    {site.isActive ? 'Actif' : 'Inactif'}
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
                        <Link href={`/sites/${site.id}`}>Voir le détail</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditSite(site); setDialogOpen(true); }}>
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(site.id)}
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

      <SiteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        site={editSite}
        defaultClientId={defaultClientId}
      />
    </div>
  );
}
```

**Step 3: `apps/web/src/app/(app)/sites/page.tsx`**

```typescript
import { SitesTable } from './sites-table';

export const metadata = { title: 'Sites — ExeTeam' };

interface Props {
  searchParams: { clientId?: string };
}

export default function SitesPage({ searchParams }: Props) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sites</h1>
        <p className="text-muted-foreground">Gestion des sites d'intervention</p>
      </div>
      <SitesTable defaultClientId={searchParams.clientId} />
    </div>
  );
}
```

**Commit:**
```bash
git add "apps/web/src/app/(app)/sites"
git commit -m "feat(web): add /sites page with table, stats bar, typology filter, and form dialog"
```

---

## Task 5: Next.js /sites/[id] detail page

**Files to create:**
- `apps/web/src/app/(app)/sites/[id]/site-detail.tsx`
- `apps/web/src/app/(app)/sites/[id]/page.tsx`

**Step 1: `apps/web/src/app/(app)/sites/[id]/site-detail.tsx`**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { MapPin, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { sitesApi } from '@/lib/api/sites';

const statusLabels: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  en_cours: 'default',
  terminee: 'secondary',
  livree: 'secondary',
  en_attente: 'outline',
  en_revision: 'outline',
};

export function SiteDetail({ id }: { id: string }) {
  const { data: site, isLoading } = useQuery({
    queryKey: ['site', id],
    queryFn: () => sitesApi.getOne(id),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Chargement...</div>;
  if (!site) return <div className="p-6">Site introuvable</div>;

  const hasGps = !!(site.latitude && site.longitude);
  const mapsUrl = hasGps
    ? `https://www.openstreetmap.org/?mlat=${site.latitude}&mlon=${site.longitude}&zoom=17`
    : null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <Badge variant="outline" className="font-mono text-sm">{site.reference}</Badge>
          <Badge variant={site.isActive ? 'default' : 'secondary'}>
            {site.isActive ? 'Actif' : 'Inactif'}
          </Badge>
          {site.typologie && (
            <Badge variant="outline">{site.typologie.name}</Badge>
          )}
          {hasGps && (
            <Badge className="bg-green-500 text-white">
              <MapPin className="mr-1 h-3 w-3" />
              GPS
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="infos">
        <TabsList className="mb-6">
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="taches">
            Tâches ({(site as any)._count?.tasks ?? 0})
          </TabsTrigger>
          <TabsTrigger value="champs-perso">Champs perso</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="infos">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Localisation</h3>
              {site.address && <p className="text-sm">{site.address}</p>}
              {(site.commune || site.departement) && (
                <p className="text-sm">
                  {[site.commune, site.departement].filter(Boolean).join(', ')}
                </p>
              )}
              {hasGps && (
                <div className="space-y-1">
                  <p className="text-sm font-mono text-muted-foreground">
                    {site.latitude?.toFixed(6)}, {site.longitude?.toFixed(6)}
                  </p>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Voir sur OpenStreetMap
                    </a>
                  )}
                </div>
              )}
              {!site.address && !site.commune && !hasGps && (
                <p className="text-sm text-muted-foreground">Aucune information de localisation</p>
              )}
            </div>

            <div className="bg-card border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Affectations</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-24">Client</span>
                  {site.client ? (
                    <Link href={`/clients/${site.client.id}`} className="hover:underline font-medium">
                      {site.client.name}
                    </Link>
                  ) : '—'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-24">Opérateur</span>
                  <span>{site.operator?.name ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-24">Pays</span>
                  <span>{site.country}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="taches">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Code produit</TableHead>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!(site as any).tasks || (site as any).tasks.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucune tâche
                    </TableCell>
                  </TableRow>
                )}
                {(site as any).tasks?.map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Link href={`/tasks/${task.id}`} className="font-mono text-sm hover:underline">
                        {task.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>
                      {task.codeProduit ? (
                        <span className="font-mono text-xs">{task.codeProduit.code}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {task.employee
                        ? `${task.employee.firstName} ${task.employee.lastName}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[task.status] ?? 'outline'}>
                        {statusLabels[task.status] ?? task.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

**Step 2: `apps/web/src/app/(app)/sites/[id]/page.tsx`**

```typescript
import { SiteDetail } from './site-detail';

interface Props {
  params: { id: string };
}

export const metadata = { title: 'Détail site — ExeTeam' };

export default function SiteDetailPage({ params }: Props) {
  return <SiteDetail id={params.id} />;
}
```

**Commit:**
```bash
git add "apps/web/src/app/(app)/sites/[id]"
git commit -m "feat(web): add /sites/[id] detail page with infos, GPS, and tasks tab"
```

---

## Task 6: Verification + push

```bash
# Build check
pnpm build

# Run API and test endpoints:
# GET  /sites/typologies                 → list seeded typologies
# GET  /sites/stats                      → {total, active, inactive, withActiveTasks}
# POST /sites { "reference":"S001", "name":"Tour A", "clientId":"<uuid>" }
# POST /sites { "reference":"S001", "name":"Tour B", "clientId":"<uuid>" }
#   → 409 ConflictException (same ref + clientId)
# GET  /sites?search=tour&typologieId=<id>
# GET  /sites/<id>                       → includes tasks with codeProduit + employee

# Push branch
git push -u origin feat/sites
```

**Commit:**
```bash
git add -A && git commit -m "chore(sprint-2b): final verification — sites module complete"
```

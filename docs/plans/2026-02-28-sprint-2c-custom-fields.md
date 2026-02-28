# ExeTeam Sprint 2C — Codes Produits + Custom Fields Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Codes Produits catalogue and the generic Custom Fields engine — shared types, NestJS API endpoints, a React DynamicForm renderer, a CustomFieldsBuilder UI, and the /products page. Wire the builder into the /clients/[id] "Champs perso" tab.

**Architecture:** Custom field configurations are stored as JSONB (`customFieldsConfig`) on Client and Project rows. Field data is stored as JSONB (`customFieldsData`) on Site and Task rows. The engine merges configs (project overrides client by key) and renders typed inputs. The column selector is a reusable Popover component for DataTables.

**Tech Stack:** NestJS · Prisma JSONB · packages/shared types · TanStack Query · react-hook-form + zod · shadcn/ui

**Prerequisite:** Sprint 1 complete. Sprint 2A complete (ClientsModule, clientsApi available). TanStack Query provider in place.

---

## Task 1: Create branch `feat/custom-fields`

```bash
git checkout main && git pull origin main
git checkout -b feat/custom-fields
```

**Commit:**
```bash
git add -A && git commit -m "chore: create feat/custom-fields branch"
```

---

## Task 2: Shared custom fields types

**File to create:** `packages/shared/src/types/custom-fields.ts`

```typescript
export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multiselect';

export interface CustomFieldConfig {
  /** Unique snake_case identifier for this field */
  key: string;
  /** Human-readable label */
  label: string;
  type: CustomFieldType;
  required: boolean;
  /** For select / multiselect types */
  options?: string[];
  /** Show this field as a column in list views */
  showInList: boolean;
  /** Display order (ascending) */
  order: number;
}

export type CustomFieldsData = Record<
  string,
  string | number | boolean | string[] | null
>;
```

**File to update:** `packages/shared/src/index.ts`

Add the following export line at the bottom (or alongside existing exports):

```typescript
export * from './types/custom-fields';
```

**Commit:**
```bash
git add packages/shared/src/types/custom-fields.ts packages/shared/src/index.ts
git commit -m "feat(shared): add CustomFieldConfig and CustomFieldsData types"
```

---

## Task 3: NestJS CodesProduitsModule

**Files to create:**
- `apps/api/src/codes-produits/dto/create-code-produit.dto.ts`
- `apps/api/src/codes-produits/dto/list-codes-produits.dto.ts`
- `apps/api/src/codes-produits/codes-produits.service.ts`
- `apps/api/src/codes-produits/codes-produits.controller.ts`
- `apps/api/src/codes-produits/codes-produits.module.ts`

**Step 1: `apps/api/src/codes-produits/dto/create-code-produit.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ProductTypeEnum = z.enum([
  'etude',
  'plan',
  'note_calcul',
  'releve',
  'doe',
  'apd',
  'pdb',
  'maj',
  'autre',
]);

export const UnitTypeEnum = z.enum([
  'piece',
  'heure',
  'forfait',
  'ml',
  'm2',
]);

export const CreateCodeProduitSchema = z.object({
  code: z.string().min(1),
  designation: z.string().min(1),
  clientId: z.string().uuid(),
  productType: ProductTypeEnum.default('autre'),
  unitType: UnitTypeEnum.default('piece'),
  unitPrice: z.number().min(0),
  timeGamme: z.number().min(0).optional(),
  currencyId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

export class CreateCodeProduitDto extends createZodDto(CreateCodeProduitSchema) {}

export const UpdateCodeProduitSchema = CreateCodeProduitSchema.partial();
export class UpdateCodeProduitDto extends createZodDto(UpdateCodeProduitSchema) {}
```

**Step 2: `apps/api/src/codes-produits/dto/list-codes-produits.dto.ts`**

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProductTypeEnum } from './create-code-produit.dto';

export const ListCodesProduitsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  clientId: z.string().optional(),
  productType: ProductTypeEnum.optional(),
  isActive: z.coerce.boolean().optional(),
});

export class ListCodesProduitsDto extends createZodDto(ListCodesProduitsSchema) {}
```

**Step 3: `apps/api/src/codes-produits/codes-produits.service.ts`**

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCodeProduitDto,
  UpdateCodeProduitDto,
} from './dto/create-code-produit.dto';
import { ListCodesProduitsDto } from './dto/list-codes-produits.dto';

@Injectable()
export class CodesProduitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListCodesProduitsDto) {
    const { page, limit, search, clientId, productType, isActive } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where['OR'] = [
        { code: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (clientId) where['clientId'] = clientId;
    if (productType) where['productType'] = productType;
    if (isActive !== undefined) where['isActive'] = isActive;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.codeProduit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          client: { select: { id: true, name: true } },
          currency: { select: { id: true, code: true, symbol: true } },
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.codeProduit.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const cp = await this.prisma.codeProduit.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        currency: { select: { id: true, code: true, symbol: true } },
        _count: { select: { tasks: true } },
      },
    });
    if (!cp) throw new NotFoundException(`Code produit ${id} not found`);
    return cp;
  }

  async create(dto: CreateCodeProduitDto) {
    const existing = await this.prisma.codeProduit.findFirst({
      where: { code: dto.code, clientId: dto.clientId },
    });
    if (existing) {
      throw new ConflictException(
        `Un code produit "${dto.code}" existe déjà pour ce client`,
      );
    }

    return this.prisma.codeProduit.create({
      data: dto,
      include: {
        client: { select: { id: true, name: true } },
        currency: { select: { id: true, code: true, symbol: true } },
      },
    });
  }

  async update(id: string, dto: UpdateCodeProduitDto) {
    await this.findOne(id);
    return this.prisma.codeProduit.update({
      where: { id },
      data: dto,
      include: {
        client: { select: { id: true, name: true } },
        currency: { select: { id: true, code: true, symbol: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.codeProduit.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

**Step 4: `apps/api/src/codes-produits/codes-produits.controller.ts`**

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
import { CodesProduitsService } from './codes-produits.service';
import {
  CreateCodeProduitDto,
  UpdateCodeProduitDto,
} from './dto/create-code-produit.dto';
import { ListCodesProduitsDto } from './dto/list-codes-produits.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('codes-produits')
export class CodesProduitsController {
  constructor(private readonly codesProduitsService: CodesProduitsService) {}

  @Get()
  @RequirePermissions('clients.read')
  findAll(@Query() dto: ListCodesProduitsDto) {
    return this.codesProduitsService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('clients.read')
  findOne(@Param('id') id: string) {
    return this.codesProduitsService.findOne(id);
  }

  @Post()
  @RequirePermissions('clients.create')
  create(@Body() dto: CreateCodeProduitDto) {
    return this.codesProduitsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateCodeProduitDto) {
    return this.codesProduitsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  remove(@Param('id') id: string) {
    return this.codesProduitsService.remove(id);
  }
}
```

**Step 5: `apps/api/src/codes-produits/codes-produits.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { CodesProduitsService } from './codes-produits.service';
import { CodesProduitsController } from './codes-produits.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CodesProduitsController],
  providers: [CodesProduitsService],
  exports: [CodesProduitsService],
})
export class CodesProduitsModule {}
```

**Commit:**
```bash
git add apps/api/src/codes-produits
git commit -m "feat(api): add CodesProduitsModule with CRUD and uniqueness check"
```

---

## Task 4: NestJS CustomFieldsModule

**Files to create:**
- `apps/api/src/custom-fields/custom-fields.service.ts`
- `apps/api/src/custom-fields/custom-fields.controller.ts`
- `apps/api/src/custom-fields/custom-fields.module.ts`

**Step 1: `apps/api/src/custom-fields/custom-fields.service.ts`**

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CustomFieldConfig, CustomFieldsData } from '@exeteam/shared';

function validateConfig(config: CustomFieldConfig[]): void {
  const snakeCaseRegex = /^[a-z][a-z0-9_]*$/;
  const keys = new Set<string>();

  for (const field of config) {
    if (!snakeCaseRegex.test(field.key)) {
      throw new BadRequestException(
        `Invalid field key "${field.key}": must be snake_case (lowercase letters, digits, underscores)`,
      );
    }
    if (keys.has(field.key)) {
      throw new BadRequestException(`Duplicate field key: "${field.key}"`);
    }
    keys.add(field.key);

    if (
      (field.type === 'select' || field.type === 'multiselect') &&
      (!field.options || field.options.length === 0)
    ) {
      throw new BadRequestException(
        `Field "${field.key}" of type "${field.type}" must have at least one option`,
      );
    }
  }
}

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(
    clientId: string,
    projectId?: string,
  ): Promise<CustomFieldConfig[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { customFieldsConfig: true },
    });

    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    const clientConfig = (client.customFieldsConfig as CustomFieldConfig[]) ?? [];

    if (!projectId) {
      return clientConfig.sort((a, b) => a.order - b.order);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { customFieldsConfig: true },
    });

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const projectConfig = (project.customFieldsConfig as CustomFieldConfig[]) ?? [];

    // Merge: project fields override client fields by key
    const merged = new Map<string, CustomFieldConfig>();
    for (const field of clientConfig) {
      merged.set(field.key, field);
    }
    for (const field of projectConfig) {
      merged.set(field.key, field);
    }

    return Array.from(merged.values()).sort((a, b) => a.order - b.order);
  }

  async updateClientConfig(
    clientId: string,
    config: CustomFieldConfig[],
  ) {
    validateConfig(config);

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    return this.prisma.client.update({
      where: { id: clientId },
      data: { customFieldsConfig: config as any },
      select: { id: true, customFieldsConfig: true },
    });
  }

  async updateProjectConfig(
    projectId: string,
    config: CustomFieldConfig[],
  ) {
    validateConfig(config);

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    return this.prisma.project.update({
      where: { id: projectId },
      data: { customFieldsConfig: config as any },
      select: { id: true, customFieldsConfig: true },
    });
  }

  async updateSiteData(siteId: string, data: CustomFieldsData) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException(`Site ${siteId} not found`);

    return this.prisma.site.update({
      where: { id: siteId },
      data: { customFieldsData: data as any },
      select: { id: true, customFieldsData: true },
    });
  }

  async updateTaskData(taskId: string, data: CustomFieldsData) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    return this.prisma.task.update({
      where: { id: taskId },
      data: { customFieldsData: data as any },
      select: { id: true, customFieldsData: true },
    });
  }
}
```

**Step 2: `apps/api/src/custom-fields/custom-fields.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CustomFieldsService } from './custom-fields.service';
import type { CustomFieldConfig, CustomFieldsData } from '@exeteam/shared';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get('config')
  @RequirePermissions('custom_fields.read')
  getConfig(
    @Query('clientId') clientId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.customFieldsService.getConfig(clientId, projectId);
  }

  @Put('clients/:id/config')
  @RequirePermissions('custom_fields.configure')
  updateClientConfig(
    @Param('id') id: string,
    @Body() body: { config: CustomFieldConfig[] },
  ) {
    return this.customFieldsService.updateClientConfig(id, body.config);
  }

  @Put('projects/:id/config')
  @RequirePermissions('custom_fields.configure')
  updateProjectConfig(
    @Param('id') id: string,
    @Body() body: { config: CustomFieldConfig[] },
  ) {
    return this.customFieldsService.updateProjectConfig(id, body.config);
  }

  @Patch('sites/:id/data')
  @RequirePermissions('custom_fields.update')
  updateSiteData(
    @Param('id') id: string,
    @Body() body: { data: CustomFieldsData },
  ) {
    return this.customFieldsService.updateSiteData(id, body.data);
  }

  @Patch('tasks/:id/data')
  @RequirePermissions('custom_fields.update')
  updateTaskData(
    @Param('id') id: string,
    @Body() body: { data: CustomFieldsData },
  ) {
    return this.customFieldsService.updateTaskData(id, body.data);
  }
}
```

**Step 3: `apps/api/src/custom-fields/custom-fields.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { CustomFieldsController } from './custom-fields.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
```

**Step 4: Register both new modules in `apps/api/src/app.module.ts`**

```typescript
// Add imports:
import { CodesProduitsModule } from './codes-produits/codes-produits.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';

// Add to @Module({ imports: [...] }):
// CodesProduitsModule,
// CustomFieldsModule,
```

**Commit:**
```bash
git add apps/api/src/custom-fields apps/api/src/app.module.ts
git commit -m "feat(api): add CustomFieldsModule with config merge, JSONB data update endpoints"
```

---

## Task 5: Next.js DynamicForm component

**File to create:** `apps/web/src/components/custom-fields/dynamic-form.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CustomFieldConfig, CustomFieldsData } from '@exeteam/shared';

interface DynamicFormProps {
  config: CustomFieldConfig[];
  defaultValues?: CustomFieldsData;
  onSubmit: (data: CustomFieldsData) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

export function DynamicForm({
  config,
  defaultValues = {},
  onSubmit,
  isLoading,
  readOnly,
}: DynamicFormProps) {
  const { register, handleSubmit, watch, setValue } = useForm<CustomFieldsData>({
    defaultValues,
  });

  const sorted = [...config].sort((a, b) => a.order - b.order);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {sorted.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {field.type === 'text' && (
            <Input
              id={field.key}
              {...register(field.key)}
              disabled={readOnly}
            />
          )}

          {field.type === 'number' && (
            <Input
              id={field.key}
              type="number"
              {...register(field.key, { valueAsNumber: true })}
              disabled={readOnly}
            />
          )}

          {field.type === 'date' && (
            <Input
              id={field.key}
              type="date"
              {...register(field.key)}
              disabled={readOnly}
            />
          )}

          {field.type === 'boolean' && (
            <div className="flex items-center gap-2">
              <Switch
                id={field.key}
                checked={!!watch(field.key)}
                onCheckedChange={(checked) => setValue(field.key, checked)}
                disabled={readOnly}
              />
            </div>
          )}

          {field.type === 'select' && (
            <Select
              defaultValue={String(defaultValues[field.key] ?? '')}
              onValueChange={(v) => setValue(field.key, v)}
              disabled={readOnly}
            >
              <SelectTrigger id={field.key}>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === 'multiselect' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1 mb-2">
                {(watch(field.key) as string[] ?? []).map((v) => (
                  <Badge key={v} variant="secondary" className="gap-1">
                    {v}
                    {!readOnly && (
                      <button
                        type="button"
                        className="ml-1 text-xs"
                        onClick={() => {
                          const current = (watch(field.key) as string[]) ?? [];
                          setValue(field.key, current.filter((x) => x !== v));
                        }}
                      >
                        ×
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
              {field.options?.map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <Checkbox
                    id={`${field.key}-${opt}`}
                    checked={(watch(field.key) as string[] ?? []).includes(opt)}
                    onCheckedChange={(checked) => {
                      const current = (watch(field.key) as string[]) ?? [];
                      setValue(
                        field.key,
                        checked ? [...current, opt] : current.filter((x) => x !== opt),
                      );
                    }}
                    disabled={readOnly}
                  />
                  <label htmlFor={`${field.key}-${opt}`} className="text-sm">{opt}</label>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      )}
    </form>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/custom-fields/dynamic-form.tsx
git commit -m "feat(web): add DynamicForm component rendering all CustomFieldConfig types"
```

---

## Task 6: Next.js CustomFieldsBuilder component

**File to create:** `apps/web/src/components/custom-fields/custom-fields-builder.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/api/client';
import type { CustomFieldConfig, CustomFieldType } from '@exeteam/shared';

const typeLabels: Record<CustomFieldType, string> = {
  text: 'Texte',
  number: 'Nombre',
  date: 'Date',
  boolean: 'Oui/Non',
  select: 'Sélection',
  multiselect: 'Sélection multiple',
};

const fieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'snake_case requis'),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'boolean', 'select', 'multiselect']),
  required: z.boolean().default(false),
  showInList: z.boolean().default(false),
});

type FieldFormValues = z.infer<typeof fieldSchema>;

function sanitizeToSnakeCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+/, '');
}

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (field: CustomFieldConfig) => void;
  existingCount: number;
}

function AddFieldDialog({ open, onOpenChange, onAdd, existingCount }: AddFieldDialogProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');

  const form = useForm<FieldFormValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues: { key: '', label: '', type: 'text', required: false, showInList: false },
  });

  const fieldType = form.watch('type');
  const needsOptions = fieldType === 'select' || fieldType === 'multiselect';

  const handleAddOption = () => {
    if (optionInput.trim() && !options.includes(optionInput.trim())) {
      setOptions([...options, optionInput.trim()]);
      setOptionInput('');
    }
  };

  const handleSubmit = (values: FieldFormValues) => {
    onAdd({
      ...values,
      options: needsOptions ? options : undefined,
      order: existingCount,
    });
    form.reset();
    setOptions([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un champ</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="label" render={({ field }) => (
              <FormItem>
                <FormLabel>Libellé *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      const currentKey = form.getValues('key');
                      if (!currentKey) {
                        form.setValue('key', sanitizeToSnakeCase(e.target.value));
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="key" render={({ field }) => (
              <FormItem>
                <FormLabel>Clé (snake_case) *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => field.onChange(sanitizeToSnakeCase(e.target.value))}
                    className="font-mono"
                    placeholder="ex: numero_affaire"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {needsOptions && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex gap-2">
                  <Input
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    placeholder="Nouvelle option..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={handleAddOption}>
                    Ajouter
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {options.map((opt) => (
                    <Badge
                      key={opt}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setOptions(options.filter((o) => o !== opt))}
                    >
                      {opt} ×
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <FormField control={form.control} name="required" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Requis</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="showInList" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Afficher en liste</FormLabel>
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit">Ajouter</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomFieldsBuilder({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: config = [], isLoading } = useQuery({
    queryKey: ['custom-fields-config', clientId],
    queryFn: () => apiRequest<CustomFieldConfig[]>(`/custom-fields/config?clientId=${clientId}`),
  });

  const saveMutation = useMutation({
    mutationFn: (newConfig: CustomFieldConfig[]) =>
      apiRequest(`/custom-fields/clients/${clientId}/config`, {
        method: 'PUT',
        body: JSON.stringify({ config: newConfig }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields-config', clientId] });
    },
  });

  const handleAdd = (field: CustomFieldConfig) => {
    saveMutation.mutate([...config, field]);
  };

  const handleDelete = (key: string) => {
    saveMutation.mutate(config.filter((f) => f.key !== key));
  };

  const handleToggleShowInList = (key: string, value: boolean) => {
    saveMutation.mutate(
      config.map((f) => (f.key === key ? { ...f, showInList: value } : f)),
    );
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {config.length} champ(s) configuré(s)
        </p>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un champ
        </Button>
      </div>

      {config.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Aucun champ personnalisé configuré pour ce client
        </div>
      )}

      <div className="space-y-2">
        {[...config].sort((a, b) => a.order - b.order).map((field) => (
          <div
            key={field.key}
            className="flex items-center gap-3 border rounded-lg p-3 bg-card"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{field.label}</span>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{field.key}</code>
                <Badge variant="outline" className="text-xs">{typeLabels[field.type]}</Badge>
                {field.required && <Badge variant="destructive" className="text-xs">Requis</Badge>}
              </div>
              {field.options && field.options.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {field.options.map((opt) => (
                    <Badge key={opt} variant="secondary" className="text-xs">{opt}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={field.showInList}
                  onCheckedChange={(v) => handleToggleShowInList(field.key, v)}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground">Liste</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(field.key)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AddFieldDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAdd}
        existingCount={config.length}
      />
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/custom-fields/custom-fields-builder.tsx
git commit -m "feat(web): add CustomFieldsBuilder with add/delete/toggle and snake_case validation"
```

---

## Task 7: Next.js ColumnSelector component

**File to create:** `apps/web/src/components/custom-fields/column-selector.tsx`

```typescript
'use client';

import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface ColumnDefinition {
  key: string;
  label: string;
  required?: boolean;
}

interface ColumnSelectorProps {
  columns: ColumnDefinition[];
  visibleColumns: Set<string>;
  onToggle: (key: string) => void;
}

export function ColumnSelector({
  columns,
  visibleColumns,
  onToggle,
}: ColumnSelectorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" />
          Colonnes
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <p className="text-sm font-medium mb-3">Colonnes visibles</p>
        <div className="space-y-2">
          {columns.map((col) => (
            <div key={col.key} className="flex items-center gap-2">
              <Checkbox
                id={`col-${col.key}`}
                checked={visibleColumns.has(col.key)}
                onCheckedChange={() => !col.required && onToggle(col.key)}
                disabled={col.required}
              />
              <Label
                htmlFor={`col-${col.key}`}
                className={col.required ? 'text-muted-foreground' : ''}
              >
                {col.label}
                {col.required && ' *'}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Commit:**
```bash
git add apps/web/src/components/custom-fields/column-selector.tsx
git commit -m "feat(web): add ColumnSelector popover for DataTable column visibility"
```

---

## Task 8: Next.js /products page

**Files to create:**
- `apps/web/src/lib/api/products.ts`
- `apps/web/src/app/(app)/products/product-form-dialog.tsx`
- `apps/web/src/app/(app)/products/products-table.tsx`
- `apps/web/src/app/(app)/products/page.tsx`

**Step 1: `apps/web/src/lib/api/products.ts`**

```typescript
import { apiRequest } from './client';

export interface CodeProduit {
  id: string;
  code: string;
  designation: string;
  clientId: string;
  client?: { id: string; name: string };
  productType: string;
  unitType: string;
  unitPrice: number;
  timeGamme?: number;
  currencyId?: string;
  currency?: { id: string; code: string; symbol: string };
  isActive: boolean;
  _count: { tasks: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: string;
  productType?: string;
  isActive?: boolean;
}

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') q.set(key, String(value));
  }
  return q.toString() ? `?${q.toString()}` : '';
}

export const productsApi = {
  list: (params: ListProductsParams = {}) =>
    apiRequest<PaginatedResponse<CodeProduit>>(`/codes-produits${toQuery(params)}`),

  getOne: (id: string) => apiRequest<CodeProduit>(`/codes-produits/${id}`),

  create: (body: Record<string, unknown>) =>
    apiRequest<CodeProduit>('/codes-produits', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<CodeProduit>(`/codes-produits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    apiRequest<CodeProduit>(`/codes-produits/${id}`, { method: 'DELETE' }),
};
```

**Step 2: `apps/web/src/app/(app)/products/product-form-dialog.tsx`**

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
import { productsApi, CodeProduit } from '@/lib/api/products';
import { clientsApi } from '@/lib/api/clients';

const productTypes = [
  { value: 'etude', label: 'Étude' },
  { value: 'plan', label: 'Plan' },
  { value: 'note_calcul', label: 'Note de calcul' },
  { value: 'releve', label: 'Relevé' },
  { value: 'doe', label: 'DOE' },
  { value: 'apd', label: 'APD' },
  { value: 'pdb', label: 'PDB' },
  { value: 'maj', label: 'MAJ' },
  { value: 'autre', label: 'Autre' },
];

const unitTypes = [
  { value: 'piece', label: 'Pièce' },
  { value: 'heure', label: 'Heure' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'ml', label: 'ml' },
  { value: 'm2', label: 'm²' },
];

const formSchema = z.object({
  code: z.string().min(1, 'Code requis'),
  designation: z.string().min(1, 'Désignation requise'),
  clientId: z.string().uuid('Client requis'),
  productType: z.string().default('autre'),
  unitType: z.string().default('piece'),
  unitPrice: z.coerce.number().min(0, 'Prix requis'),
  timeGamme: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: CodeProduit;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: ProductFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!product;

  const { data: clients } = useQuery({
    queryKey: ['clients', { limit: 100 }],
    queryFn: () => clientsApi.list({ limit: 100 }),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: product?.code ?? '',
      designation: product?.designation ?? '',
      clientId: product?.clientId ?? '',
      productType: product?.productType ?? 'autre',
      unitType: product?.unitType ?? 'piece',
      unitPrice: product?.unitPrice ?? 0,
      timeGamme: product?.timeGamme,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? productsApi.update(product!.id, values)
        : productsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le code produit' : 'Nouveau code produit'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code *</FormLabel>
                  <FormControl><Input {...field} className="font-mono" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
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
            </div>

            <FormField control={form.control} name="designation" render={({ field }) => (
              <FormItem>
                <FormLabel>Désignation *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="productType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de produit</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {productTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unité</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {unitTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="unitPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prix unitaire *</FormLabel>
                  <FormControl><Input {...field} type="number" step="0.01" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="timeGamme" render={({ field }) => (
                <FormItem>
                  <FormLabel>Temps gamme (h)</FormLabel>
                  <FormControl><Input {...field} type="number" step="0.5" /></FormControl>
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

**Step 3: `apps/web/src/app/(app)/products/products-table.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus } from 'lucide-react';
import { productsApi, CodeProduit, ListProductsParams } from '@/lib/api/products';
import { clientsApi } from '@/lib/api/clients';
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
import { ProductFormDialog } from './product-form-dialog';

const productTypeLabels: Record<string, string> = {
  etude: 'Étude', plan: 'Plan', note_calcul: 'Note de calcul',
  releve: 'Relevé', doe: 'DOE', apd: 'APD', pdb: 'PDB', maj: 'MAJ', autre: 'Autre',
};

export function ProductsTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [productType, setProductType] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<CodeProduit | undefined>();
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const params: ListProductsParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    clientId: clientId || undefined,
    productType: productType || undefined,
  };

  const { data: clients } = useQuery({
    queryKey: ['clients', { limit: 100 }],
    queryFn: () => clientsApi.list({ limit: 100 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', params],
    queryFn: () => productsApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Input
          placeholder="Code, désignation..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Select value={clientId} onValueChange={(v) => { setClientId(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tous les clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {clients?.data.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={productType} onValueChange={(v) => { setProductType(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tous types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {Object.entries(productTypeLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={() => { setEditProduct(undefined); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau code produit
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead>Prix HT</TableHead>
              <TableHead>Temps gamme</TableHead>
              <TableHead>Tâches</TableHead>
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
            {data?.data.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono font-medium">{product.code}</TableCell>
                <TableCell>{product.designation}</TableCell>
                <TableCell>{product.client?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{productTypeLabels[product.productType] ?? product.productType}</Badge>
                </TableCell>
                <TableCell>{product.unitType}</TableCell>
                <TableCell>
                  {product.unitPrice.toFixed(2)} {product.currency?.symbol ?? '€'}
                </TableCell>
                <TableCell>
                  {product.timeGamme != null ? `${product.timeGamme}h` : '—'}
                </TableCell>
                <TableCell>{product._count.tasks}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditProduct(product); setDialogOpen(true); }}>
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(product.id)}
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

      <ProductFormDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editProduct} />
    </div>
  );
}
```

**Step 4: `apps/web/src/app/(app)/products/page.tsx`**

```typescript
import { ProductsTable } from './products-table';

export const metadata = { title: 'Codes Produits — ExeTeam' };

export default function ProductsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Codes Produits</h1>
        <p className="text-muted-foreground">Catalogue des codes produits par client</p>
      </div>
      <ProductsTable />
    </div>
  );
}
```

**Commit:**
```bash
git add apps/web/src/lib/api/products.ts "apps/web/src/app/(app)/products"
git commit -m "feat(web): add /products page with filters, table, and create/edit dialog"
```

---

## Task 9: Wire CustomFieldsBuilder into /clients/[id] "Champs perso" tab

**File to modify:** `apps/web/src/app/(app)/clients/[id]/client-detail.tsx`

Replace the "Champs perso" TabsContent placeholder with the actual builder:

```typescript
// Add import at the top:
import { CustomFieldsBuilder } from '@/components/custom-fields/custom-fields-builder';

// Replace this TabsContent:
// <TabsContent value="champs-perso">
//   <div className="text-muted-foreground py-8 text-center">
//     Champs personnalisés disponibles en Sprint 2C
//   </div>
// </TabsContent>

// With:
<TabsContent value="champs-perso">
  <CustomFieldsBuilder clientId={id} />
</TabsContent>
```

**Commit:**
```bash
git add "apps/web/src/app/(app)/clients/[id]/client-detail.tsx"
git commit -m "feat(web): wire CustomFieldsBuilder into /clients/[id] champs-perso tab"
```

---

## Task 10: Verification + push

```bash
# Build check
pnpm build

# Test API endpoints:
# GET  /custom-fields/config?clientId=<uuid>         → []
# PUT  /custom-fields/clients/<uuid>/config           → { config: [{key:"ref_op",label:"Ref OP",type:"text",...}] }
# GET  /custom-fields/config?clientId=<uuid>         → [{key:"ref_op",...}]
# PUT  /custom-fields/clients/<uuid>/config           → { config: [{key:"invalid key",...}] } → 400 BadRequest
# PUT  /custom-fields/clients/<uuid>/config           → { config: [{key:"type_sel",type:"select",options:[],...}] } → 400 (no options)
# GET  /codes-produits?clientId=<uuid>
# POST /codes-produits { "code":"P001","designation":"Étude infra","clientId":"<uuid>","unitPrice":150 }
# POST /codes-produits { "code":"P001","clientId":"<uuid>",... } → 409 Conflict

# Push branch
git push -u origin feat/custom-fields
```

**Commit:**
```bash
git add -A && git commit -m "chore(sprint-2c): final verification — custom fields engine and codes produits complete"
```

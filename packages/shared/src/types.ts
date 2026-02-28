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

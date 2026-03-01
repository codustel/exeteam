import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListImportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z
    .enum(['clients', 'employees', 'sites', 'tasks', 'purchase-invoices'])
    .optional(),
  status: z.enum(['pending', 'processing', 'done', 'failed']).optional(),
});

export class ListImportsDto extends createZodDto(ListImportsSchema) {}

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SaveTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  entityType: z.enum(['clients', 'employees', 'sites', 'tasks', 'purchase-invoices']),
  mappings: z.record(z.string(), z.string()),
});

export class SaveTemplateDto extends createZodDto(SaveTemplateSchema) {}

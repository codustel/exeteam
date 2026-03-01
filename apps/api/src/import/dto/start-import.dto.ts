import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StartImportSchema = z.object({
  entityType: z.enum(['clients', 'employees', 'sites', 'tasks', 'purchase-invoices']),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  mappings: z.record(z.string(), z.string()),
  onDuplicate: z.enum(['skip', 'update']).default('skip'),
  templateId: z.string().uuid().optional(),
});

export class StartImportDto extends createZodDto(StartImportSchema) {}

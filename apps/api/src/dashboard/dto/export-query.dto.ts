import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ExportQuerySchema = z.object({
  type: z.enum(['general', 'production', 'financier', 'rentabilite']),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  format: z.literal('xlsx').default('xlsx'),
});

export class ExportQueryDto extends createZodDto(ExportQuerySchema) {}

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const FinancierQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export class FinancierQueryDto extends createZodDto(FinancierQuerySchema) {}

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ProductionQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  operatorId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

export class ProductionQueryDto extends createZodDto(ProductionQuerySchema) {}

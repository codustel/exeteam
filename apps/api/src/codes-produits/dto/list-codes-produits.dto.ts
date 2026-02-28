import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListCodesProduitsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  productType: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export class ListCodesProduitsDto extends createZodDto(ListCodesProduitsSchema) {}

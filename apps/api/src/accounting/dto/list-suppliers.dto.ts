import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListSuppliersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export class ListSuppliersDto extends createZodDto(ListSuppliersSchema) {}

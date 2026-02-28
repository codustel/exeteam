import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListClientsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  operatorId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
});

export class ListClientsDto extends createZodDto(ListClientsSchema) {}

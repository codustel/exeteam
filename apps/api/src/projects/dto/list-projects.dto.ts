import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  operatorId: z.string().uuid().optional(),
  responsibleId: z.string().uuid().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export class ListProjectsDto extends createZodDto(ListProjectsSchema) {}

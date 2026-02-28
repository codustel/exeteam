import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListSitesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  operatorId: z.string().uuid().optional(),
  typologieId: z.string().uuid().optional(),
  commune: z.string().optional(),
  departement: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export class ListSitesDto extends createZodDto(ListSitesSchema) {}

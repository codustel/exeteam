import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListTasksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  projectId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  codeProduitId: z.string().uuid().optional(),
  status: z.string().optional(),
  facturable: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export class ListTasksDto extends createZodDto(ListTasksSchema) {}

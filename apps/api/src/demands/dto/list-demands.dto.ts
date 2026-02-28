import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DemandStatusValues, DemandPriorityValues } from './create-demand.dto';

export const ListDemandsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  status: z.enum(DemandStatusValues).optional(),
  priority: z.enum(DemandPriorityValues).optional(),
  employeeId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export class ListDemandsDto extends createZodDto(ListDemandsSchema) {}

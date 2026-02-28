import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListLeavesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  status: z.string().optional(),
  leaveTypeId: z.string().uuid().optional(),
  startDateFrom: z.string().optional(),
  startDateTo: z.string().optional(),
});

export class ListLeavesDto extends createZodDto(ListLeavesSchema) {}

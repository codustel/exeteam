import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListEmployeesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  contractType: z.string().optional(),
  managerId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export class ListEmployeesDto extends createZodDto(ListEmployeesSchema) {}

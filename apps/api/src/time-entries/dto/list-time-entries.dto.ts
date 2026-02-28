import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListTimeEntriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  taskId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  isValidated: z.coerce.boolean().optional(),
});

export class ListTimeEntriesDto extends createZodDto(ListTimeEntriesSchema) {}

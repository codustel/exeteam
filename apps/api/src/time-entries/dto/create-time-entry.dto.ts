import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTimeEntrySchema = z.object({
  taskId: z.string().uuid(),
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  hours: z.coerce.number().positive().max(24),
  comment: z.string().optional(),
});

export class CreateTimeEntryDto extends createZodDto(CreateTimeEntrySchema) {}

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ExportTimesheetSchema = z.object({
  employeeId: z.string().uuid().optional(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  format: z.enum(['csv']).default('csv'),
});

export class ExportTimesheetDto extends createZodDto(ExportTimesheetSchema) {}

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const MonthlyTimesheetSchema = z.object({
  employeeId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
});

export class MonthlyTimesheetDto extends createZodDto(MonthlyTimesheetSchema) {}

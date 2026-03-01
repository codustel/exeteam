import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const WeeklyTimesheetSchema = z.object({
  employeeId: z.string().uuid(),
  weekStart: z.coerce.date(),
});

export class WeeklyTimesheetDto extends createZodDto(WeeklyTimesheetSchema) {}

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const TeamTimesheetSchema = z.object({
  managerId: z.string().uuid().optional(),
  weekStart: z.coerce.date(),
});

export class TeamTimesheetDto extends createZodDto(TeamTimesheetSchema) {}

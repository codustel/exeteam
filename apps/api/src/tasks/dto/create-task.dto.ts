import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  codeProduitId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  demandId: z.string().uuid().optional(),
  status: z.string().default('a_traiter'),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  dateReception: z.coerce.date().optional(),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  actualStartDate: z.coerce.date().optional(),
  actualEndDate: z.coerce.date().optional(),
  estimatedHours: z.coerce.number().nonnegative().optional(),
  budgetHours: z.coerce.number().nonnegative().optional(),
  facturable: z.boolean().default(true),
  customFieldsData: z.record(z.unknown()).optional(),
  tagIds: z.array(z.string().uuid()).default([]),
});

export class CreateTaskDto extends createZodDto(CreateTaskSchema) {}

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),
  responsibleId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  status: z.string().default('brouillon'),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  actualStartDate: z.coerce.date().optional(),
  actualEndDate: z.coerce.date().optional(),
  budgetHours: z.coerce.number().nonnegative().optional(),
  customFieldsConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  tagIds: z.array(z.string().uuid()).default([]),
});

export class CreateProjectDto extends createZodDto(CreateProjectSchema) {}

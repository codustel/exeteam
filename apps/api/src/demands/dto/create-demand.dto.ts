import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DemandStatusValues = ['nouvelle', 'en_cours', 'terminee', 'annulee'] as const;
export const DemandPriorityValues = ['basse', 'normale', 'haute', 'urgente'] as const;

export const CreateDemandSchema = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid(),
  codeProduitId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  demandeurId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  dataLink: z.string().url().optional().or(z.literal('')),
  status: z.enum(DemandStatusValues).default('nouvelle'),
  priority: z.enum(DemandPriorityValues).default('normale'),
  requestedAt: z.coerce.date().optional(),
  desiredDelivery: z.coerce.date().optional(),
});

export class CreateDemandDto extends createZodDto(CreateDemandSchema) {}

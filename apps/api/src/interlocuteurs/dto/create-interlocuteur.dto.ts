import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateInterlocuteurSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  fonction: z.enum(['chef_projet', 'charge_affaire', 'resp_be', 'autre']).optional(),
  isActive: z.boolean().optional().default(true),
});

export class CreateInterlocuteurDto extends createZodDto(CreateInterlocuteurSchema) {}
export class UpdateInterlocuteurDto extends createZodDto(CreateInterlocuteurSchema.partial()) {}

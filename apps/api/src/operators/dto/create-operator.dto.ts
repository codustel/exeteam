import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateOperatorSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  contact: z.string().optional(),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().optional().default(true),
});

export class CreateOperatorDto extends createZodDto(CreateOperatorSchema) {}
export class UpdateOperatorDto extends createZodDto(CreateOperatorSchema.partial()) {}

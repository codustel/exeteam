import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional().default('#FF6600'),
});

export const UpdateTagSchema = CreateTagSchema.partial();

export class CreateTagDto extends createZodDto(CreateTagSchema) {}
export class UpdateTagDto extends createZodDto(UpdateTagSchema) {}

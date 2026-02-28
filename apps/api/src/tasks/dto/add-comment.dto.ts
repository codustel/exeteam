import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddCommentSchema = z.object({
  content: z.string().min(1),
  attachments: z.array(z.string()).default([]),
});

export class AddCommentDto extends createZodDto(AddCommentSchema) {}

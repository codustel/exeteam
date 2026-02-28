import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SendMessageSchema = z.object({
  content: z.string().min(1),
  fileUrl: z.string().url().optional(),
});

export class SendMessageDto extends createZodDto(SendMessageSchema) {}

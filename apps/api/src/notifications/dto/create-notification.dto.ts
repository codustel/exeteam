import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  link: z.string().optional(),
});

export class CreateNotificationDto extends createZodDto(CreateNotificationSchema) {}

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z.coerce.boolean().optional(),
});

export class ListNotificationsDto extends createZodDto(ListNotificationsSchema) {}

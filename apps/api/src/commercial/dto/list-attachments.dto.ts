import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListAttachmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  period: z.string().optional(),
  status: z.string().optional(),
});

export class ListAttachmentsDto extends createZodDto(ListAttachmentsSchema) {}

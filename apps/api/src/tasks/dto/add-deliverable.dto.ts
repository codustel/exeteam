import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddDeliverableSchema = z.object({
  url: z.string().url(),
  type: z.enum(['sharepoint', 'onedrive', 'dropbox', 'gdrive', 'url']).optional(),
  label: z.string().optional(),
});

export class AddDeliverableDto extends createZodDto(AddDeliverableSchema) {}

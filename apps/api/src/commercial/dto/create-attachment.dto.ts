import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateAttachmentSchema = z.object({
  reference: z.string().min(1).max(100),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  currencyId: z.string().uuid().optional(),
  // Task IDs to include as lines (must have facturable=true)
  taskIds: z.array(z.string().uuid()).min(1, 'Au moins une tâche requise'),
});

export class CreateAttachmentDto extends createZodDto(CreateAttachmentSchema) {}
export class UpdateAttachmentDto extends createZodDto(CreateAttachmentSchema.partial()) {}

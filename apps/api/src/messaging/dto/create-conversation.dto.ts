import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateConversationSchema = z.object({
  name: z.string().max(200).optional(),
  isGroup: z.boolean().optional().default(false),
  memberEmployeeIds: z.array(z.string().uuid()).min(1, 'Au moins un membre requis'),
});

export class CreateConversationDto extends createZodDto(CreateConversationSchema) {}

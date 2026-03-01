import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateConfigSchema = z.object({
  config: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      type: z.enum(['text', 'number', 'date', 'boolean', 'select', 'multiselect']),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      showInList: z.boolean().optional(),
    }),
  ),
});

export class UpdateConfigDto extends createZodDto(UpdateConfigSchema) {}

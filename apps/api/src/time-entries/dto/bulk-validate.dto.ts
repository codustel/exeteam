import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const BulkValidateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export class BulkValidateDto extends createZodDto(BulkValidateSchema) {}

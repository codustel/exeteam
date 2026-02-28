import { createZodDto } from 'nestjs-zod';
import { CreateTimeEntrySchema } from './create-time-entry.dto';

export const UpdateTimeEntrySchema = CreateTimeEntrySchema.omit({ taskId: true }).partial();
export class UpdateTimeEntryDto extends createZodDto(UpdateTimeEntrySchema) {}

import { createZodDto } from 'nestjs-zod';
import { CreateDemandSchema } from './create-demand.dto';

export const UpdateDemandSchema = CreateDemandSchema.partial();

export class UpdateDemandDto extends createZodDto(UpdateDemandSchema) {}

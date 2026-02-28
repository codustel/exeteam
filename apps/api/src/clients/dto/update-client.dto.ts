import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { CreateClientSchema } from './create-client.dto';

export const UpdateClientSchema = CreateClientSchema.partial();
export class UpdateClientDto extends createZodDto(UpdateClientSchema) {}

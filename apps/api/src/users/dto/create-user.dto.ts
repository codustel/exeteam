import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
  associateEmployeeId: z.string().uuid().optional(),
  associateInterlocuteurId: z.string().uuid().optional(),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().datetime({ offset: true }).optional(),
  nationality: z.string().max(50).optional(),
  photoUrl: z.string().url().optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  postalCode: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(50).optional().default('FR'),
  personalEmail: z.string().email().optional(),
  professionalEmail: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  contractType: z.enum(['cdi', 'cdd', 'stage', 'freelance', 'alternance']).optional(),
  entryDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  trialEndDate: z.string().datetime({ offset: true }).optional(),
  position: z.string().max(200).optional(),
  weeklyHours: z.number().min(0).max(60).optional(),
  managerId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
});

export class CreateEmployeeDto extends createZodDto(CreateEmployeeSchema) {}
export class UpdateEmployeeDto extends createZodDto(CreateEmployeeSchema.partial()) {}

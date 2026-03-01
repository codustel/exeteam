import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  vatNumber: z.string().max(30).optional().or(z.literal('')),
  siret: z.string().max(20).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export class CreateSupplierDto extends createZodDto(CreateSupplierSchema) {}
export class UpdateSupplierDto extends createZodDto(CreateSupplierSchema.partial()) {}

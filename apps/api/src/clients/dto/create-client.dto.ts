import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateClientSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  postalCode: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(50).optional().default('FR'),
  vatNumber: z.string().max(50).optional(),
  siret: z.string().max(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  paymentConditions: z.string().max(200).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  // Tag IDs to associate
  tagIds: z.array(z.string().uuid()).optional(),
  // Operator IDs to associate
  operatorIds: z.array(z.string().uuid()).optional(),
});

export class CreateClientDto extends createZodDto(CreateClientSchema) {}

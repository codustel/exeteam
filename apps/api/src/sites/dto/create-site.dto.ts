import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateSiteSchema = z.object({
  reference: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  clientId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),
  typologieId: z.string().uuid().optional(),
  address: z.string().optional(),
  postalCode: z.string().max(20).optional(),
  commune: z.string().max(100).optional(),
  departement: z.string().max(100).optional(),
  country: z.string().max(50).optional().default('FR'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  customFieldsData: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional().default(true),
});

export class CreateSiteDto extends createZodDto(CreateSiteSchema) {}
export class UpdateSiteDto extends createZodDto(CreateSiteSchema.partial()) {}

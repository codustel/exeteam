import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateCodeProduitSchema = z.object({
  code: z.string().min(1).max(50),
  designation: z.string().min(1).max(300),
  clientId: z.string().uuid(),
  productType: z.enum(['etude', 'plan', 'note_calcul', 'releve', 'doe', 'apd', 'pdb', 'maj', 'autre']).optional(),
  unitType: z.enum(['piece', 'heure', 'forfait', 'ml', 'm2']).optional(),
  unitPrice: z.number().min(0),
  timeGamme: z.number().min(0).optional(), // hours per unit
  currencyId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
});

export class CreateCodeProduitDto extends createZodDto(CreateCodeProduitSchema) {}
export class UpdateCodeProduitDto extends createZodDto(CreateCodeProduitSchema.partial()) {}

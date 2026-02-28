import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const QuoteLineSchema = z.object({
  designation: z.string().min(1),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  codeProduitId: z.string().uuid().optional(),
  order: z.coerce.number().int().optional().default(0),
});

export const CreateQuoteSchema = z.object({
  reference: z.string().min(1).max(100),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  quoteDate: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  status: z.enum(['brouillon', 'envoye', 'accepte', 'refuse', 'expire']).optional().default('brouillon'),
  vatRate: z.coerce.number().min(0).max(100).optional().default(20),
  discount: z.coerce.number().min(0).max(100).optional(),
  currencyId: z.string().uuid().optional(),
  conditions: z.string().optional(),
  lines: z.array(QuoteLineSchema).min(1),
});

export class CreateQuoteDto extends createZodDto(CreateQuoteSchema) {}
export class UpdateQuoteDto extends createZodDto(CreateQuoteSchema.partial()) {}

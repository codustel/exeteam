import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const InvoiceLineSchema = z.object({
  designation: z.string().min(1),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  codeProduitId: z.string().uuid().optional(),
  order: z.coerce.number().int().optional().default(0),
});

export const CreateInvoiceSchema = z.object({
  reference: z.string().min(1).max(100),
  clientId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  attachmentId: z.string().uuid().optional(),
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(['brouillon', 'envoye', 'paye', 'retard', 'annule']).optional().default('brouillon'),
  vatRate: z.coerce.number().min(0).max(100).optional().default(20),
  currencyId: z.string().uuid().optional(),
  lines: z.array(InvoiceLineSchema).min(1),
});

export class CreateInvoiceDto extends createZodDto(CreateInvoiceSchema) {}
export class UpdateInvoiceDto extends createZodDto(CreateInvoiceSchema.partial()) {}

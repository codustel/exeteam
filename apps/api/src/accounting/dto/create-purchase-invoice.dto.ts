import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreatePurchaseInvoiceSchema = z
  .object({
    reference: z.string().min(1).max(100),
    supplierId: z.string().uuid(),
    invoiceDate: z.coerce.date(),
    dueDate: z.coerce.date().optional(),
    totalHt: z.coerce.number().min(0),
    vatRate: z.coerce.number().min(0).max(100).default(20),
    notes: z.string().max(2000).optional().or(z.literal('')),
  })
  .transform((data) => {
    const vatAmount = data.totalHt * (data.vatRate / 100);
    const totalTtc = data.totalHt + vatAmount;
    return { ...data, vatAmount, totalTtc };
  });

export class CreatePurchaseInvoiceDto extends createZodDto(
  CreatePurchaseInvoiceSchema,
) {}

export const UpdatePurchaseInvoiceSchema = z.object({
  reference: z.string().min(1).max(100).optional(),
  supplierId: z.string().uuid().optional(),
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  status: z
    .enum([
      'en_attente',
      'validee',
      'payee_partiellement',
      'payee',
      'annulee',
    ])
    .optional(),
  totalHt: z.coerce.number().min(0).optional(),
  vatAmount: z.coerce.number().min(0).optional(),
  totalTtc: z.coerce.number().min(0).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
  fileUrl: z.string().url().optional().nullable(),
});

export class UpdatePurchaseInvoiceDto extends createZodDto(
  UpdatePurchaseInvoiceSchema,
) {}

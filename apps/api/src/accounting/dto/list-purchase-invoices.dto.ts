import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListPurchaseInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export class ListPurchaseInvoicesDto extends createZodDto(
  ListPurchaseInvoicesSchema,
) {}

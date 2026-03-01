import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateOrderSchema = z.object({
  reference: z.string().min(1).max(100),
  clientId: z.string().uuid(),
  quoteId: z.string().uuid().optional(),
  orderDate: z.coerce.date().optional(),
  amount: z.coerce.number().min(0),
  status: z
    .enum(['brouillon', 'confirme', 'en_cours', 'livre', 'annule'])
    .optional()
    .default('brouillon'),
  notes: z.string().optional(),
});

export const UpdateOrderSchema = CreateOrderSchema.partial();

export class CreateOrderDto extends createZodDto(CreateOrderSchema) {}
export class UpdateOrderDto extends createZodDto(UpdateOrderSchema) {}

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateExpenseReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  amount: z.coerce.number().min(0),
  vatAmount: z.coerce.number().min(0).optional(),
  expenseDate: z.coerce.date(),
  receiptUrl: z.string().url().optional().nullable(),
  currencyId: z.string().uuid().optional(),
});

export class CreateExpenseReportDto extends createZodDto(
  CreateExpenseReportSchema,
) {}
export class UpdateExpenseReportDto extends createZodDto(
  CreateExpenseReportSchema.partial(),
) {}

export const ApproveExpenseSchema = z.object({
  action: z.enum(['approuve', 'refuse']),
  comment: z.string().max(500).optional(),
});

export class ApproveExpenseDto extends createZodDto(ApproveExpenseSchema) {}

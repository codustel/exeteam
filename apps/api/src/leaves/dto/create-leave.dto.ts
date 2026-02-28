import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  reason: z.string().max(500).optional(),
});

export class CreateLeaveDto extends createZodDto(CreateLeaveSchema) {}

export const ApproveLeaveSchema = z.object({
  comment: z.string().max(500).optional(),
});

export class ApproveLeaveDto extends createZodDto(ApproveLeaveSchema) {}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { ListAttachmentsDto } from './dto/list-attachments.dto';

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListAttachmentsDto) {
    const { page, limit, search, clientId, projectId, period, status } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(period ? { period } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.attachment.findMany({
        where, skip, take: limit,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, reference: true, title: true } },
          currency: { select: { code: true, symbol: true } },
          _count: { select: { lines: true, invoices: true } },
        },
        orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.attachment.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const att = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, addressLine1: true, city: true } },
        project: { select: { id: true, reference: true, title: true } },
        currency: { select: { code: true, symbol: true } },
        lines: {
          include: {
            codeProduit: { select: { code: true, designation: true, unitType: true, unitPrice: true } },
          },
        },
        invoices: { select: { id: true, reference: true, status: true, totalTtc: true } },
      },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }

  // Generate attachment from facturable tasks
  async create(dto: CreateAttachmentDto) {
    const existing = await this.prisma.attachment.findUnique({ where: { reference: dto.reference } });
    if (existing) throw new BadRequestException(`Attachment "${dto.reference}" already exists`);

    // Load tasks and validate facturable
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: dto.taskIds }, facturable: true, deletedAt: null },
      include: {
        codeProduit: { select: { code: true, designation: true, unitPrice: true, unitType: true } },
        site: { select: { id: true, reference: true } },
        timeEntries: { select: { hours: true } },
      },
    });

    if (tasks.length === 0) {
      throw new BadRequestException('No facturable tasks found for the given IDs');
    }

    const foundIds = new Set(tasks.map(t => t.id));
    const missing = dto.taskIds.filter(id => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Tasks not found or not facturable: ${missing.join(', ')}`,
      );
    }

    // Build attachment lines grouped by codeProduit+site; compute total
    let totalHt = 0;
    const linesData = tasks.map(task => {
      const realHours = task.timeEntries.reduce((s, te) => s + Number(te.hours), 0);
      const unitPrice = Number(task.codeProduit?.unitPrice ?? 0);
      const qty = task.codeProduit?.unitType === 'heure' ? realHours : 1;
      const lineTotal = unitPrice * qty;
      totalHt += lineTotal;
      return {
        codeProduitId: task.codeProduitId,
        siteId: task.siteId ?? undefined,
        quantity: qty,
        unitPrice,
        totalHt: lineTotal,
      };
    });

    return this.prisma.attachment.create({
      data: {
        reference: dto.reference,
        clientId: dto.clientId,
        projectId: dto.projectId,
        period: dto.period,
        currencyId: dto.currencyId,
        totalHt,
        status: 'genere',
        lines: { create: linesData },
      },
      include: {
        client: { select: { id: true, name: true } },
        lines: {
          include: {
            codeProduit: { select: { code: true, designation: true } },
          },
        },
        currency: { select: { code: true, symbol: true } },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);
    return this.prisma.attachment.update({ where: { id }, data: { status } });
  }

  // Get facturable tasks for period/client (to show in generation UI)
  async getFacturableTasks(clientId: string, period: string) {
    const [year, month] = period.split('-').map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);

    return this.prisma.task.findMany({
      where: {
        facturable: true,
        deletedAt: null,
        project: { clientId },
        actualEndDate: { gte: from, lte: to },
      },
      include: {
        codeProduit: { select: { code: true, designation: true, unitPrice: true, unitType: true } },
        site: { select: { reference: true } },
        project: { select: { reference: true } },
        timeEntries: { select: { hours: true } },
      },
      orderBy: [{ project: { reference: 'asc' } }, { reference: 'asc' }],
    });
  }

  async getStats() {
    const [total, byStatus] = await Promise.all([
      this.prisma.attachment.count(),
      this.prisma.attachment.groupBy({ by: ['status'], _count: true }),
    ]);
    const pendingAmount = await this.prisma.attachment.aggregate({
      where: { status: { in: ['genere', 'envoye'] } },
      _sum: { totalHt: true },
    });
    return {
      total,
      byStatus,
      pendingAmount: Number(pendingAmount._sum.totalHt ?? 0),
    };
  }
}

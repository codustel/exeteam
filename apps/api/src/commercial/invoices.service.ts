import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/create-invoice.dto';

function computeTotals(lines: Array<{ quantity: number; unitPrice: number }>, vatRate: number) {
  const totalHt = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const vatAmount = totalHt * (vatRate / 100);
  return { totalHt, vatAmount, totalTtc: totalHt + vatAmount };
}

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; limit?: number; clientId?: string; status?: string; search?: string }) {
    const { page = 1, limit = 20, clientId, status, search } = params;
    const skip = (page - 1) * limit;
    const where: any = {
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { reference: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip, take: limit,
        include: {
          client: { select: { id: true, name: true } },
          order: { select: { id: true, reference: true } },
          currency: { select: { code: true, symbol: true } },
        },
        orderBy: { invoiceDate: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, addressLine1: true, city: true, vatNumber: true } },
        order: { select: { id: true, reference: true } },
        attachment: { select: { id: true, reference: true, period: true } },
        currency: { select: { code: true, symbol: true } },
        lines: { orderBy: { order: 'asc' } },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async create(dto: CreateInvoiceDto) {
    const existing = await this.prisma.invoice.findUnique({ where: { reference: dto.reference } });
    if (existing) throw new BadRequestException(`Invoice "${dto.reference}" already exists`);

    const { lines, vatRate = 20, ...data } = dto;
    const { totalHt, vatAmount, totalTtc } = computeTotals(lines, vatRate);

    return this.prisma.invoice.create({
      data: {
        ...data, vatRate, totalHt, vatAmount, totalTtc,
        lines: {
          create: lines.map((l, idx) => ({
            designation: l.designation,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            totalHt: l.quantity * l.unitPrice,
            order: l.order ?? idx,
            ...(l.codeProduitId ? { codeProduitId: l.codeProduitId } : {}),
          })),
        },
      },
      include: {
        client: { select: { id: true, name: true } },
        lines: { orderBy: { order: 'asc' } },
        currency: { select: { code: true, symbol: true } },
      },
    });
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    await this.findOne(id);
    const { lines, vatRate, ...data } = dto;
    const totals = lines ? computeTotals(lines, vatRate ?? 20) : {};
    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...data,
        ...(vatRate !== undefined ? { vatRate } : {}),
        ...totals,
        ...(lines ? {
          lines: {
            deleteMany: {},
            create: lines.map((l, idx) => ({
              designation: l.designation,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              totalHt: l.quantity * l.unitPrice,
              order: l.order ?? idx,
              ...(l.codeProduitId ? { codeProduitId: l.codeProduitId } : {}),
            })),
          },
        } : {}),
      },
      include: { client: { select: { id: true, name: true } }, lines: true },
    });
  }

  async recordPayment(id: string, amount: number) {
    const inv = await this.findOne(id);
    const newPaid = Number(inv.amountPaid) + amount;
    const status = newPaid >= Number(inv.totalTtc) ? 'paye' : inv.status;
    return this.prisma.invoice.update({
      where: { id },
      data: { amountPaid: newPaid, status },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.invoice.delete({ where: { id } });
  }
}

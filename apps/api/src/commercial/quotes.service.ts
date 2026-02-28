import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/create-quote.dto';

function computeTotals(
  lines: Array<{ quantity: number; unitPrice: number }>,
  globalVatRate: number,
  discount?: number,
) {
  const totalHtBeforeDiscount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discountMultiplier = discount ? (1 - discount / 100) : 1;
  const totalHt = totalHtBeforeDiscount * discountMultiplier;
  const vatAmount = totalHt * (globalVatRate / 100);
  const totalTtc = totalHt + vatAmount;
  return { totalHt, vatAmount, totalTtc };
}

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number; limit?: number; clientId?: string; status?: string; search?: string;
  }) {
    const { page = 1, limit = 20, clientId, status, search } = params;
    const skip = (page - 1) * limit;
    const where: any = {
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({
        where, skip, take: limit,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, reference: true } },
          currency: { select: { code: true, symbol: true } },
          _count: { select: { lines: true, orders: true } },
        },
        orderBy: { quoteDate: 'desc' },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, addressLine1: true, city: true, vatNumber: true } },
        project: { select: { id: true, reference: true, title: true } },
        currency: { select: { code: true, symbol: true } },
        lines: { orderBy: { order: 'asc' } },
        orders: { select: { id: true, reference: true, status: true } },
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async create(dto: CreateQuoteDto) {
    const existing = await this.prisma.quote.findUnique({ where: { reference: dto.reference } });
    if (existing) throw new BadRequestException(`Quote "${dto.reference}" already exists`);

    const { lines, vatRate = 20, discount, ...data } = dto;
    const { totalHt, vatAmount, totalTtc } = computeTotals(lines, vatRate, discount);

    return this.prisma.quote.create({
      data: {
        ...data, vatRate, discount, totalHt, vatAmount, totalTtc,
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

  async update(id: string, dto: UpdateQuoteDto) {
    await this.findOne(id);
    const { lines, vatRate, discount, ...data } = dto;
    const totals = lines ? computeTotals(lines, vatRate ?? 20, discount) : {};

    return this.prisma.quote.update({
      where: { id },
      data: {
        ...data,
        ...(vatRate !== undefined ? { vatRate } : {}),
        ...(discount !== undefined ? { discount } : {}),
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
      include: {
        client: { select: { id: true, name: true } },
        lines: { orderBy: { order: 'asc' } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.quote.delete({ where: { id } });
  }
}

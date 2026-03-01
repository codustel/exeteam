import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePurchaseInvoiceDto,
  UpdatePurchaseInvoiceDto,
} from './dto/create-purchase-invoice.dto';
import { ListPurchaseInvoicesDto } from './dto/list-purchase-invoices.dto';

@Injectable()
export class PurchaseInvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListPurchaseInvoicesDto) {
    const { page, limit, search, supplierId, status, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(supplierId ? { supplierId } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate
        ? {
            invoiceDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                reference: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                supplier: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                notes: { contains: search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { invoiceDate: 'desc' },
      }),
      this.prisma.purchaseInvoice.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { supplier: true },
    });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    return invoice;
  }

  async create(dto: CreatePurchaseInvoiceDto) {
    const existing = await this.prisma.purchaseInvoice.findUnique({
      where: { reference: dto.reference },
    });
    if (existing)
      throw new BadRequestException(
        `Reference "${dto.reference}" already exists`,
      );

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const { vatRate, ...data } = dto;
    return this.prisma.purchaseInvoice.create({
      data,
      include: { supplier: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdatePurchaseInvoiceDto) {
    await this.findOne(id);

    if (dto.reference) {
      const existing = await this.prisma.purchaseInvoice.findFirst({
        where: { reference: dto.reference, id: { not: id } },
      });
      if (existing)
        throw new BadRequestException(
          `Reference "${dto.reference}" already exists`,
        );
    }

    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: dto,
      include: { supplier: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.purchaseInvoice.delete({ where: { id } });
  }

  async attachFile(id: string, fileUrl: string) {
    await this.findOne(id);
    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: { fileUrl },
    });
  }

  async getStats() {
    const [total, byStatus, sums] = await Promise.all([
      this.prisma.purchaseInvoice.count(),
      this.prisma.purchaseInvoice.groupBy({ by: ['status'], _count: true }),
      this.prisma.purchaseInvoice.aggregate({
        _sum: { totalHt: true, totalTtc: true, amountPaid: true },
      }),
    ]);

    const overdue = await this.prisma.purchaseInvoice.count({
      where: {
        status: 'en_attente',
        dueDate: { lt: new Date() },
      },
    });

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      totalHt: Number(sums._sum.totalHt ?? 0),
      totalTtc: Number(sums._sum.totalTtc ?? 0),
      amountPaid: Number(sums._sum.amountPaid ?? 0),
      amountDue:
        Number(sums._sum.totalTtc ?? 0) - Number(sums._sum.amountPaid ?? 0),
      overdue,
    };
  }
}

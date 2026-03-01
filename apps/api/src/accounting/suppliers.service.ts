import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersDto } from './dto/list-suppliers.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListSuppliersDto) {
    const { page, limit, search, isActive } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { siret: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        include: { _count: { select: { purchaseInvoices: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { purchaseInvoices: true } },
        purchaseInvoices: {
          take: 10,
          orderBy: { invoiceDate: 'desc' },
          select: {
            id: true,
            reference: true,
            status: true,
            totalTtc: true,
            invoiceDate: true,
          },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getStats() {
    const [total, active] = await Promise.all([
      this.prisma.supplier.count(),
      this.prisma.supplier.count({ where: { isActive: true } }),
    ]);
    const totalPurchaseHt = await this.prisma.purchaseInvoice.aggregate({
      _sum: { totalHt: true },
    });
    return {
      total,
      active,
      inactive: total - active,
      totalPurchaseHt: Number(totalPurchaseHt._sum.totalHt ?? 0),
    };
  }
}

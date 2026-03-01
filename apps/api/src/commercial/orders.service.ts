import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
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
      this.prisma.order.findMany({
        where, skip, take: limit,
        include: {
          client: { select: { id: true, name: true } },
          quote: { select: { id: true, reference: true } },
        },
        orderBy: { orderDate: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, addressLine1: true, city: true } },
        quote: { select: { id: true, reference: true, status: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(dto: CreateOrderDto) {
    const existing = await this.prisma.order.findUnique({ where: { reference: dto.reference } });
    if (existing) throw new BadRequestException(`Order "${dto.reference}" already exists`);

    const { orderDate, ...rest } = dto;
    return this.prisma.order.create({
      data: {
        ...rest,
        orderDate: orderDate ?? new Date(),
      },
      include: {
        client: { select: { id: true, name: true } },
        quote: { select: { id: true, reference: true } },
      },
    });
  }

  async update(id: string, dto: UpdateOrderDto) {
    await this.findOne(id);
    return this.prisma.order.update({
      where: { id },
      data: dto,
      include: {
        client: { select: { id: true, name: true } },
        quote: { select: { id: true, reference: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.order.delete({ where: { id } });
  }
}

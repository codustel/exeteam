import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/create-operator.dto';

@Injectable()
export class OperatorsService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.operator.findMany({
      where: {
        isActive: true,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      include: { _count: { select: { clients: true, sites: true, projects: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id },
      include: {
        clients: { include: { client: { select: { id: true, name: true, logoUrl: true } } } },
        _count: { select: { sites: true, projects: true } },
      },
    });
    if (!operator) throw new NotFoundException('Operator not found');
    return operator;
  }

  create(dto: CreateOperatorDto) {
    return this.prisma.operator.create({ data: dto });
  }

  async update(id: string, dto: UpdateOperatorDto) {
    await this.findOne(id);
    return this.prisma.operator.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.operator.update({ where: { id }, data: { isActive: false } });
  }
}

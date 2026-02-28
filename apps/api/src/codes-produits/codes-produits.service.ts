import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCodeProduitDto, UpdateCodeProduitDto } from './dto/create-code-produit.dto';
import { ListCodesProduitsDto } from './dto/list-codes-produits.dto';

@Injectable()
export class CodesProduitsService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListCodesProduitsDto) {
    const { page, limit, search, clientId, productType, isActive } = dto;
    const skip = (page - 1) * limit;

    const where = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(clientId ? { clientId } : {}),
      ...(productType ? { productType } : {}),
      ...(search ? {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { designation: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.codeProduit.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: { select: { id: true, name: true } },
          currency: { select: { code: true, symbol: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: [{ client: { name: 'asc' } }, { code: 'asc' }],
      }),
      this.prisma.codeProduit.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const item = await this.prisma.codeProduit.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        currency: { select: { code: true, symbol: true } },
        _count: { select: { tasks: true, demands: true } },
      },
    });
    if (!item) throw new NotFoundException('Code produit not found');
    return item;
  }

  async create(dto: CreateCodeProduitDto) {
    const existing = await this.prisma.codeProduit.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Code "${dto.code}" already exists`);
    return this.prisma.codeProduit.create({
      data: dto,
      include: { client: { select: { id: true, name: true } }, currency: true },
    });
  }

  async update(id: string, dto: UpdateCodeProduitDto) {
    await this.findOne(id);
    return this.prisma.codeProduit.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.codeProduit.update({ where: { id }, data: { isActive: false } });
  }
}

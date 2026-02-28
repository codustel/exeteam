import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListClientsDto): Promise<any> {
    const { page, limit, search, isActive, operatorId, tagId } = dto;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { legalName: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
          { siret: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(operatorId ? { operators: { some: { operatorId } } } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        include: {
          operators: { include: { operator: { select: { id: true, name: true, logoUrl: true } } } },
          tags: { include: { tag: true } },
          _count: { select: { sites: true, projects: true, interlocuteurs: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { id, deletedAt: null },
      include: {
        operators: { include: { operator: true } },
        interlocuteurs: { where: { deletedAt: null }, orderBy: { firstName: 'asc' } },
        tags: { include: { tag: true } },
        codesProduits: { where: { isActive: true }, orderBy: { code: 'asc' } },
        _count: { select: { sites: true, projects: true, demands: true } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(dto: CreateClientDto): Promise<any> {
    const { tagIds, operatorIds, ...data } = dto;
    return this.prisma.client.create({
      data: {
        ...data,
        ...(tagIds?.length ? {
          tags: {
            create: tagIds.map(tagId => ({ tagId, entityType: 'client' })),
          },
        } : {}),
        ...(operatorIds?.length ? {
          operators: {
            create: operatorIds.map(operatorId => ({ operatorId })),
          },
        } : {}),
      },
      include: {
        operators: { include: { operator: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  async update(id: string, dto: UpdateClientDto): Promise<any> {
    await this.findOne(id);
    const { tagIds, operatorIds, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        await tx.entityTag.deleteMany({ where: { entityId: id, entityType: 'client' } });
        if (tagIds.length > 0) {
          await tx.entityTag.createMany({
            data: tagIds.map(tagId => ({ tagId, entityId: id, entityType: 'client' })),
          });
        }
      }
      if (operatorIds !== undefined) {
        await tx.clientOperator.deleteMany({ where: { clientId: id } });
        if (operatorIds.length > 0) {
          await tx.clientOperator.createMany({
            data: operatorIds.map(operatorId => ({ clientId: id, operatorId })),
          });
        }
      }
      return tx.client.update({
        where: { id },
        data,
        include: {
          operators: { include: { operator: true } },
          tags: { include: { tag: true } },
        },
      });
    });
  }

  async remove(id: string): Promise<any> {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async updateLogo(id: string, logoUrl: string): Promise<any> {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: { logoUrl } });
  }

  async getStats(): Promise<any> {
    const [total, active, withProjects] = await Promise.all([
      this.prisma.client.count({ where: { deletedAt: null } }),
      this.prisma.client.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.client.count({ where: { deletedAt: null, projects: { some: {} } } }),
    ]);
    return { total, active, inactive: total - active, withProjects };
  }
}

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto, UpdateSiteDto } from './dto/create-site.dto';
import { ListSitesDto } from './dto/list-sites.dto';

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListSitesDto): Promise<any> {
    const { page, limit, search, clientId, operatorId, typologieId, commune, departement, isActive } = dto;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(clientId ? { clientId } : {}),
      ...(operatorId ? { operatorId } : {}),
      ...(typologieId ? { typologieId } : {}),
      ...(commune ? { commune: { contains: commune, mode: 'insensitive' as const } } : {}),
      ...(departement ? { departement: { contains: departement, mode: 'insensitive' as const } } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { commune: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.site.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: { select: { id: true, name: true, logoUrl: true } },
          operator: { select: { id: true, name: true } },
          typologie: { select: { id: true, name: true, slug: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: [{ client: { name: 'asc' } }, { reference: 'asc' }],
      }),
      this.prisma.site.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<any> {
    const site = await this.prisma.site.findUnique({
      where: { id, deletedAt: null },
      include: {
        client: {
          select: {
            id: true, name: true, logoUrl: true,
            customFieldsConfig: true,
          },
        },
        operator: { select: { id: true, name: true } },
        typologie: true,
        tasks: {
          where: { deletedAt: null },
          select: {
            id: true, reference: true, title: true, status: true, priority: true,
            employee: { select: { id: true, firstName: true, lastName: true } },
            codeProduit: { select: { code: true, designation: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { tasks: true, demands: true } },
      },
    });
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  async create(dto: CreateSiteDto): Promise<any> {
    const existing = await this.prisma.site.findUnique({
      where: { clientId_reference: { clientId: dto.clientId, reference: dto.reference } },
    });
    if (existing) throw new ConflictException(`Site with reference "${dto.reference}" already exists for this client`);

    return this.prisma.site.create({
      data: dto as any,
      include: {
        client: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        typologie: true,
      },
    });
  }

  async update(id: string, dto: UpdateSiteDto): Promise<any> {
    await this.findOne(id);
    return this.prisma.site.update({
      where: { id },
      data: dto as any,
      include: {
        client: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        typologie: true,
      },
    });
  }

  async remove(id: string): Promise<any> {
    await this.findOne(id);
    return this.prisma.site.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getTypologies(): Promise<any> {
    return this.prisma.siteTypology.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async getStats(): Promise<any> {
    const [total, active, withActiveTasks] = await Promise.all([
      this.prisma.site.count({ where: { deletedAt: null } }),
      this.prisma.site.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.site.count({
        where: {
          deletedAt: null,
          tasks: { some: { status: { notIn: ['terminee', 'livree', 'annulee'] }, deletedAt: null } },
        },
      }),
    ]);

    const byTypologie = await this.prisma.site.groupBy({
      by: ['typologieId'],
      where: { deletedAt: null, isActive: true },
      _count: true,
    });

    return { total, active, inactive: total - active, withActiveTasks, byTypologie };
  }
}

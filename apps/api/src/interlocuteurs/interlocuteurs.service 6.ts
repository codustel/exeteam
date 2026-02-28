import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterlocuteurDto, UpdateInterlocuteurDto } from './dto/create-interlocuteur.dto';

@Injectable()
export class InterlocuteursService {
  constructor(private prisma: PrismaService) {}

  findByClient(clientId: string) {
    return this.prisma.interlocuteur.findMany({
      where: { clientId, deletedAt: null },
      include: { user: { select: { id: true, email: true, isActive: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.interlocuteur.findUnique({
      where: { id, deletedAt: null },
      include: {
        client: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, isActive: true } },
      },
    });
    if (!item) throw new NotFoundException('Interlocuteur not found');
    return item;
  }

  create(dto: CreateInterlocuteurDto) {
    return this.prisma.interlocuteur.create({
      data: dto,
      include: { client: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateInterlocuteurDto) {
    await this.findOne(id);
    return this.prisma.interlocuteur.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.interlocuteur.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}

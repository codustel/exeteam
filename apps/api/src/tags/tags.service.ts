import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tag.findMany({
      include: { _count: { select: { entities: true } } },
      orderBy: { name: 'asc' },
    });
  }

  create(name: string, color: string = '#FF6600') {
    return this.prisma.tag.create({ data: { name, color } });
  }

  async update(id: string, name?: string, color?: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.tag.update({ where: { id }, data: { ...(name ? { name } : {}), ...(color ? { color } : {}) } });
  }

  async remove(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.tag.delete({ where: { id } });
  }
}

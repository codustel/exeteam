import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(query: string) {
    const [clients, projects, tasks, employees, sites] = await Promise.all([
      this.prisma.client.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { siret: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, siret: true },
        take: 5,
      }),
      this.prisma.project.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { reference: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, reference: true },
        take: 5,
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { reference: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, reference: true },
        take: 5,
      }),
      this.prisma.employee.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true },
        take: 5,
      }),
      this.prisma.site.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { reference: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, reference: true },
        take: 5,
      }),
    ]);

    return {
      clients: clients.map((c) => ({ id: c.id, name: c.name, code: c.siret ?? '' })),
      projects: projects.map((p) => ({ id: p.id, name: p.title, reference: p.reference })),
      tasks,
      employees,
      sites,
    };
  }
}

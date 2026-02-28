import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListProjectsDto) {
    const { page, limit, search, clientId, operatorId, responsibleId, status, priority, isActive } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (clientId) where['clientId'] = clientId;
    if (operatorId) where['operatorId'] = operatorId;
    if (responsibleId) where['responsibleId'] = responsibleId;
    if (status) where['status'] = status;
    if (priority) where['priority'] = priority;
    if (isActive !== undefined) where['isActive'] = isActive;

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, logoUrl: true } },
          operator: { select: { id: true, name: true } },
          responsible: { select: { id: true, firstName: true, lastName: true } },
          tags: { include: { tag: true } },
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    // Compute advancement: percentage of tasks in terminal status
    const dataWithStats = await Promise.all(
      data.map(async (project) => {
        const [totalTasks, doneTasks] = await Promise.all([
          this.prisma.task.count({ where: { projectId: project.id, deletedAt: null } }),
          this.prisma.task.count({
            where: {
              projectId: project.id,
              deletedAt: null,
              status: { in: ['terminee', 'livree'] },
            },
          }),
        ]);
        const advancement = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
        return { ...project, advancement };
      }),
    );

    return { data: dataWithStats, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        operator: { select: { id: true, name: true } },
        responsible: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        tags: { include: { tag: true } },
        tasks: {
          where: { deletedAt: null },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
            codeProduit: { select: { id: true, code: true, designation: true } },
            _count: { select: { timeEntries: true, comments: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { tasks: true, demands: true, attachments: true } },
      },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async create(dto: CreateProjectDto) {
    const { tagIds, ...data } = dto;

    // Generate reference: PROJ-YYYYMM-XXXX
    const count = await this.prisma.project.count();
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const reference = `PROJ-${yyyymm}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.project.create({
      data: {
        ...data,
        reference,
        ...(tagIds?.length
          ? { tags: { create: tagIds.map((tagId) => ({ tagId, entityType: 'project' })) } }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        responsible: { select: { id: true, firstName: true, lastName: true } },
        tags: { include: { tag: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    const { tagIds, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        await tx.entityTag.deleteMany({ where: { entityId: id, entityType: 'project' } });
        if (tagIds.length > 0) {
          await tx.entityTag.createMany({
            data: tagIds.map((tagId) => ({ tagId, entityId: id, entityType: 'project' })),
          });
        }
      }
      return tx.project.update({
        where: { id },
        data,
        include: {
          client: { select: { id: true, name: true } },
          operator: { select: { id: true, name: true } },
          responsible: { select: { id: true, firstName: true, lastName: true } },
          tags: { include: { tag: true } },
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getStats() {
    const now = new Date();

    const [active, inProgress, overdue] = await Promise.all([
      this.prisma.project.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.project.count({
        where: { deletedAt: null, status: { in: ['en_cours', 'en_revision'] } },
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          isActive: true,
          plannedEndDate: { lt: now },
          status: { notIn: ['terminee', 'livree', 'annulee'] },
        },
      }),
    ]);

    // Average advancement across active projects
    const activeTasks = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: { deletedAt: null, project: { deletedAt: null, isActive: true } },
      _count: { id: true },
    });
    const doneTasks = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: {
        deletedAt: null,
        project: { deletedAt: null, isActive: true },
        status: { in: ['terminee', 'livree'] },
      },
      _count: { id: true },
    });

    let avgAdvancement = 0;
    if (activeTasks.length > 0) {
      const doneMap = new Map(doneTasks.map((d) => [d.projectId, d._count.id]));
      const total = activeTasks.reduce((sum, at) => {
        const done = doneMap.get(at.projectId) ?? 0;
        return sum + (at._count.id > 0 ? (done / at._count.id) * 100 : 0);
      }, 0);
      avgAdvancement = Math.round(total / activeTasks.length);
    }

    return { active, inProgress, avgAdvancement, overdue };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDemandDto } from './dto/create-demand.dto';
import { UpdateDemandDto } from './dto/update-demand.dto';
import { ListDemandsDto } from './dto/list-demands.dto';
import { format } from 'date-fns';

@Injectable()
export class DemandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async generateReference(): Promise<string> {
    const today = format(new Date(), 'yyyyMMdd');
    const prefix = `DEM-${today}-`;

    const count = await this.prisma.demand.count({
      where: {
        reference: { startsWith: prefix },
      },
    });

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private async generateTaskReference(): Promise<string> {
    const today = format(new Date(), 'yyyyMMdd');
    const prefix = `TSK-${today}-`;

    const count = await this.prisma.task.count({
      where: {
        reference: { startsWith: prefix },
      },
    });

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  async findAll(dto: ListDemandsDto) {
    const { page, limit, search, clientId, projectId, siteId, status, priority, employeeId, dateFrom, dateTo } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(employeeId ? { employeeId } : {}),
    };

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where['requestedAt'] = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.demand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, reference: true } },
          site: { select: { id: true, name: true } },
          demandeur: { select: { id: true, firstName: true, lastName: true, email: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          codeProduit: { select: { id: true, code: true, label: true } },
          task: { select: { id: true, reference: true, title: true, status: true } },
        },
      }),
      this.prisma.demand.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [nouvelles, enCours, termineesThisMonth, aConvertir] = await Promise.all([
      this.prisma.demand.count({ where: { deletedAt: null, status: 'nouvelle' } }),
      this.prisma.demand.count({ where: { deletedAt: null, status: 'en_cours' } }),
      this.prisma.demand.count({
        where: {
          deletedAt: null,
          status: 'terminee',
          updatedAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      this.prisma.demand.count({
        where: {
          deletedAt: null,
          status: { in: ['nouvelle', 'en_cours'] },
          task: null,
        },
      }),
    ]);

    return { nouvelles, enCours, termineesThisMonth, aConvertir };
  }

  async findOne(id: string) {
    const demand = await this.prisma.demand.findUnique({
      where: { id, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        project: { select: { id: true, name: true, reference: true } },
        site: { select: { id: true, name: true, address: true } },
        demandeur: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        employee: { select: { id: true, firstName: true, lastName: true, email: true } },
        codeProduit: { select: { id: true, code: true, label: true } },
        createdBy: { select: { id: true, email: true } },
        task: {
          select: {
            id: true,
            reference: true,
            title: true,
            status: true,
            priority: true,
            plannedEndDate: true,
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!demand) throw new NotFoundException(`Demand ${id} not found`);
    return demand;
  }

  async create(dto: CreateDemandDto, createdById: string) {
    const reference = await this.generateReference();

    const demand = await this.prisma.demand.create({
      data: {
        reference,
        projectId: dto.projectId,
        clientId: dto.clientId,
        codeProduitId: dto.codeProduitId,
        siteId: dto.siteId,
        demandeurId: dto.demandeurId,
        employeeId: dto.employeeId,
        createdById,
        title: dto.title,
        description: dto.description,
        dataLink: dto.dataLink || null,
        status: dto.status ?? 'nouvelle',
        priority: dto.priority ?? 'normale',
        requestedAt: dto.requestedAt ?? new Date(),
        desiredDelivery: dto.desiredDelivery,
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // Notify all users with demands:manage permission
    await this.notifications.emitToPermission({
      permission: 'demands.manage',
      type: 'demand_new',
      title: 'Nouvelle demande client',
      body: `${demand.reference} - ${demand.title}`,
      link: `/demands/${demand.id}`,
    });

    return demand;
  }

  async update(id: string, dto: UpdateDemandDto) {
    await this.findOne(id);

    return this.prisma.demand.update({
      where: { id },
      data: {
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
        ...(dto.codeProduitId !== undefined ? { codeProduitId: dto.codeProduitId } : {}),
        ...(dto.siteId !== undefined ? { siteId: dto.siteId } : {}),
        ...(dto.demandeurId !== undefined ? { demandeurId: dto.demandeurId } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.dataLink !== undefined ? { dataLink: dto.dataLink || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.requestedAt !== undefined ? { requestedAt: dto.requestedAt } : {}),
        ...(dto.desiredDelivery !== undefined ? { desiredDelivery: dto.desiredDelivery } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        demandeur: { select: { id: true, firstName: true, lastName: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.demand.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async convertToTask(id: string) {
    const demand = await this.findOne(id);

    if (demand.status === 'terminee' || demand.status === 'annulee') {
      throw new BadRequestException(
        `Cannot convert a demand with status "${demand.status}" to a task.`,
      );
    }

    if (demand.task) {
      throw new BadRequestException(
        `Demand ${demand.reference} already has a linked task (${demand.task.reference}).`,
      );
    }

    const taskReference = await this.generateTaskReference();

    const task = await this.prisma.$transaction(async (tx) => {
      const newTask = await tx.task.create({
        data: {
          reference: taskReference,
          projectId: demand.projectId,
          codeProduitId: demand.codeProduitId!,
          siteId: demand.siteId,
          employeeId: demand.employeeId,
          title: demand.title,
          description: demand.description,
          demandId: demand.id,
          dateReception: demand.requestedAt,
          plannedEndDate: demand.desiredDelivery,
          status: 'a_traiter',
          priority: demand.priority,
        },
        include: {
          project: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await tx.demand.update({
        where: { id: demand.id },
        data: { status: 'en_cours' },
      });

      return newTask;
    });

    // Notify assigned employee if present
    if (demand.employeeId) {
      // Find the user account linked to this employee
      const employeeUser = await this.prisma.user.findFirst({
        where: { employeeId: demand.employeeId, deletedAt: null },
        select: { id: true },
      });

      if (employeeUser) {
        await this.notifications.emit({
          userId: employeeUser.id,
          type: 'task_assigned',
          title: 'Nouvelle tâche assignée',
          body: task.title,
          link: `/tasks/${task.id}`,
        });
      }
    }

    return task;
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { AddDeliverableDto } from './dto/add-deliverable.dto';
import { AddCommentDto } from './dto/add-comment.dto';

const TERMINAL_STATUSES = ['terminee', 'livree'];

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Business Logic Helpers ────────────────────────────────────────────────

  /**
   * Calculate working days between two dates, excluding weekends
   * and French public holidays stored in the public_holidays table.
   */
  private async calcDelaiRL(
    dateReception: Date | null,
    endDate: Date | null,
  ): Promise<number | null> {
    if (!dateReception) return null;
    const end = endDate ?? new Date();

    const start = new Date(dateReception);
    start.setHours(0, 0, 0, 0);
    const finish = new Date(end);
    finish.setHours(0, 0, 0, 0);

    if (finish <= start) return 0;

    // Fetch all public holidays in the range
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        country: 'FR',
        date: { gte: start, lte: finish },
      },
      select: { date: true },
    });
    const holidaySet = new Set(
      holidays.map((h) => h.date.toISOString().split('T')[0]),
    );

    let count = 0;
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + 1); // start counting from day after reception

    while (cursor <= finish) {
      const day = cursor.getDay(); // 0=Sun, 6=Sat
      const iso = cursor.toISOString().split('T')[0];
      if (day !== 0 && day !== 6 && !holidaySet.has(iso)) {
        count++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }

  /**
   * Calculate Rendement = (timeGamme × quantity) / sum(hours) × 100
   * quantity defaults to 1 unless linked demand has a quantity.
   */
  private calcRendement(
    timeGamme: number | null,
    totalHours: number,
    quantity = 1,
  ): number | null {
    if (!timeGamme || totalHours === 0) return null;
    return Math.round(((timeGamme * quantity) / totalHours) * 100 * 10) / 10;
  }

  private async enrichTask(task: Record<string, unknown> & {
    dateReception?: Date | null;
    actualEndDate?: Date | null;
    codeProduit?: { timeGamme?: unknown } | null;
    timeEntries?: Array<{ hours: unknown }>;
  }) {
    const delaiRL = await this.calcDelaiRL(
      task.dateReception ?? null,
      task.actualEndDate ?? null,
    );

    const totalHours = (task.timeEntries ?? []).reduce(
      (sum: number, e) => sum + Number(e.hours),
      0,
    );
    const timeGamme = task.codeProduit?.timeGamme
      ? Number(task.codeProduit.timeGamme)
      : null;
    const rendement = this.calcRendement(timeGamme, totalHours, 1);

    return { ...task, delaiRL, rendement, totalHours };
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(dto: ListTasksDto) {
    const { page, limit, search, projectId, siteId, employeeId, codeProduitId, status, facturable, dateFrom, dateTo } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (projectId) where['projectId'] = projectId;
    if (siteId) where['siteId'] = siteId;
    if (employeeId) where['employeeId'] = employeeId;
    if (codeProduitId) where['codeProduitId'] = codeProduitId;
    if (status) where['status'] = status;
    if (facturable !== undefined) where['facturable'] = facturable;
    if (dateFrom || dateTo) {
      where['dateReception'] = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, reference: true, title: true } },
          site: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          codeProduit: { select: { id: true, code: true, designation: true, timeGamme: true } },
          timeEntries: { select: { hours: true } },
          demand: { select: { id: true } },
          _count: { select: { comments: true, deliverables: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    const enriched = await Promise.all(data.map((t) => this.enrichTask(t as never)));

    return { data: enriched, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id, deletedAt: null },
      include: {
        project: { select: { id: true, reference: true, title: true, customFieldsConfig: true } },
        site: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        codeProduit: { select: { id: true, code: true, designation: true, timeGamme: true } },
        demand: { select: { id: true } },
        timeEntries: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
            user: { select: { id: true, email: true } },
          },
          orderBy: { date: 'desc' },
        },
        comments: {
          include: { author: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: { user: { select: { id: true, email: true } } },
          orderBy: { changedAt: 'asc' },
        },
        deliverables: { orderBy: { createdAt: 'desc' } },
        tags: { include: { tag: true } },
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.enrichTask(task as never);
  }

  async create(dto: CreateTaskDto) {
    const { tagIds, ...data } = dto;

    const count = await this.prisma.task.count();
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const reference = `TACHE-${yyyymm}-${String(count + 1).padStart(4, '0')}`;

    const createData = {
      ...data,
      reference,
      dateLastStatus: new Date(),
      ...(data.customFieldsData ? { customFieldsData: data.customFieldsData as Prisma.InputJsonValue } : {}),
      ...(tagIds?.length
        ? { tags: { create: tagIds.map((tagId) => ({ tagId, entityType: 'task' })) } }
        : {}),
    };

    const task = await this.prisma.task.create({
      data: createData as Parameters<typeof this.prisma.task.create>[0]['data'],
      include: {
        project: { select: { id: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        codeProduit: { select: { id: true, code: true, designation: true, timeGamme: true } },
        timeEntries: { select: { hours: true } },
        demand: { select: { id: true } },
      },
    });

    return this.enrichTask(task as never);
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const existing = await this.findOne(id);
    const { tagIds, ...data } = dto;

    // Status change validation
    if (dto.status && dto.status !== (existing as Record<string, unknown>)['status']) {
      if (TERMINAL_STATUSES.includes(dto.status)) {
        const deliverableCount = await this.prisma.taskDeliverable.count({ where: { taskId: id } });
        const hasDeliverableLinks = Array.isArray((existing as Record<string, unknown>)['deliverableLinks'])
          && ((existing as Record<string, unknown>)['deliverableLinks'] as string[]).length > 0;
        if (deliverableCount === 0 && !hasDeliverableLinks) {
          throw new BadRequestException(
            `Cannot move task to "${dto.status}" without at least one deliverable link.`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        await tx.entityTag.deleteMany({ where: { entityId: id, entityType: 'task' } });
        if (tagIds.length > 0) {
          await tx.entityTag.createMany({
            data: tagIds.map((tagId) => ({ tagId, entityId: id, entityType: 'task' })),
          });
        }
      }

      // Auto-create status history on status change
      const currentStatus = (existing as Record<string, unknown>)['status'] as string;
      const updateData: Record<string, unknown> = { ...data };
      if (dto.status && dto.status !== currentStatus) {
        await tx.statusHistory.create({
          data: {
            taskId: id,
            userId,
            previousStatus: currentStatus,
            newStatus: dto.status,
          },
        });
        updateData['dateLastStatus'] = new Date();
      }

      const updated = await tx.task.update({
        where: { id },
        data: updateData as Parameters<typeof tx.task.update>[0]['data'],
        include: {
          project: { select: { id: true, reference: true, title: true, customFieldsConfig: true } },
          site: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          codeProduit: { select: { id: true, code: true, designation: true, timeGamme: true } },
          demand: { select: { id: true } },
          timeEntries: { select: { hours: true } },
          comments: {
            include: { author: { select: { id: true, email: true } } },
            orderBy: { createdAt: 'asc' },
          },
          statusHistory: {
            include: { user: { select: { id: true, email: true } } },
            orderBy: { changedAt: 'asc' },
          },
          deliverables: { orderBy: { createdAt: 'desc' } },
          tags: { include: { tag: true } },
        },
      });

      return this.enrichTask(updated as never);
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addDeliverable(taskId: string, dto: AddDeliverableDto) {
    await this.findOne(taskId);
    return this.prisma.taskDeliverable.create({ data: { taskId, ...dto } });
  }

  async removeDeliverable(taskId: string, deliverableId: string) {
    await this.findOne(taskId);
    const d = await this.prisma.taskDeliverable.findFirst({
      where: { id: deliverableId, taskId },
    });
    if (!d) throw new NotFoundException('Deliverable not found');
    return this.prisma.taskDeliverable.delete({ where: { id: deliverableId } });
  }

  async addComment(taskId: string, dto: AddCommentDto, authorId: string) {
    await this.findOne(taskId);
    return this.prisma.taskComment.create({
      data: { taskId, authorId, content: dto.content, attachments: dto.attachments },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  async deleteComment(taskId: string, commentId: string, userId: string) {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new BadRequestException('You can only delete your own comments');
    }
    return this.prisma.taskComment.delete({ where: { id: commentId } });
  }

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, inProgress, doneThisMonth] = await Promise.all([
      this.prisma.task.count({ where: { deletedAt: null } }),
      this.prisma.task.count({
        where: { deletedAt: null, status: { in: ['en_cours', 'en_revision'] } },
      }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          status: { in: ['terminee', 'livree'] },
          actualEndDate: { gte: startOfMonth },
        },
      }),
    ]);

    // Global rendement: average over tasks with time entries and a timeGamme
    const tasksWithHours = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        timeEntries: { some: {} },
        codeProduit: { timeGamme: { not: null } },
      },
      include: {
        timeEntries: { select: { hours: true } },
        codeProduit: { select: { timeGamme: true } },
      },
      take: 200,
    });

    let avgRendement = 0;
    if (tasksWithHours.length > 0) {
      const rendered = tasksWithHours
        .map((t) => {
          const totalHours = t.timeEntries.reduce((s: number, e) => s + Number(e.hours), 0);
          const tg = t.codeProduit?.timeGamme ? Number(t.codeProduit.timeGamme) : null;
          return tg && totalHours > 0 ? tg / totalHours * 100 : null;
        })
        .filter((v): v is number => v !== null);

      if (rendered.length > 0) {
        avgRendement = Math.round(rendered.reduce((s, v) => s + v, 0) / rendered.length);
      }
    }

    return { total, inProgress, doneThisMonth, avgRendement };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListTimeEntriesDto) {
    const { page, limit, taskId, employeeId, dateFrom, dateTo, isValidated } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (taskId) where['taskId'] = taskId;
    if (employeeId) where['employeeId'] = employeeId;
    if (isValidated !== undefined) where['isValidated'] = isValidated;
    if (dateFrom || dateTo) {
      where['date'] = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          task: { select: { id: true, reference: true, title: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id },
      include: {
        task: { select: { id: true, reference: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    return entry;
  }

  async create(dto: CreateTimeEntryDto, userId: string) {
    // Validate total hours on this day does not exceed 24
    const dayStart = new Date(dto.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dto.date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await this.prisma.timeEntry.aggregate({
      where: {
        employeeId: dto.employeeId,
        date: { gte: dayStart, lte: dayEnd },
      },
      _sum: { hours: true },
    });

    const currentTotal = Number(existing._sum.hours ?? 0);
    if (currentTotal + dto.hours > 24) {
      throw new BadRequestException(
        `Adding ${dto.hours}h would exceed the 24h daily cap. Current total: ${currentTotal}h.`,
      );
    }

    return this.prisma.timeEntry.create({
      data: { ...dto, userId },
      include: {
        task: { select: { id: true, reference: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTimeEntryDto) {
    await this.findOne(id);

    if (dto.hours !== undefined || dto.date !== undefined || dto.employeeId !== undefined) {
      const current = await this.findOne(id);
      const targetDate = dto.date ?? (current as Record<string, unknown>)['date'] as Date;
      const targetEmployee = dto.employeeId ?? (current as Record<string, unknown>)['employeeId'] as string;
      const targetHours = dto.hours ?? Number((current as Record<string, unknown>)['hours']);

      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const existing = await this.prisma.timeEntry.aggregate({
        where: {
          employeeId: targetEmployee,
          date: { gte: dayStart, lte: dayEnd },
          id: { not: id },
        },
        _sum: { hours: true },
      });

      const otherTotal = Number(existing._sum.hours ?? 0);
      if (otherTotal + targetHours > 24) {
        throw new BadRequestException(
          `Update would exceed the 24h daily cap. Other entries total: ${otherTotal}h.`,
        );
      }
    }

    return this.prisma.timeEntry.update({
      where: { id },
      data: dto,
      include: {
        task: { select: { id: true, reference: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.timeEntry.delete({ where: { id } });
  }

  async validate(id: string) {
    await this.findOne(id);
    return this.prisma.timeEntry.update({ where: { id }, data: { isValidated: true } });
  }
}

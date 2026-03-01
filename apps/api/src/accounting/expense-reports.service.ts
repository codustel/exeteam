import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateExpenseReportDto,
  UpdateExpenseReportDto,
  ApproveExpenseDto,
} from './dto/create-expense-report.dto';
import { ListExpenseReportsDto } from './dto/list-expense-reports.dto';

@Injectable()
export class ExpenseReportsService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListExpenseReportsDto) {
    const {
      page,
      limit,
      search,
      employeeId,
      status,
      startDate,
      endDate,
      pendingApproval,
    } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate
        ? {
            expenseDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(pendingApproval === 'true' ? { status: 'en_attente' } : {}),
      ...(search
        ? {
            OR: [
              {
                title: { contains: search, mode: 'insensitive' as const },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                employee: {
                  firstName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                employee: {
                  lastName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expenseReport.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true },
          },
          approver: {
            select: { id: true, firstName: true, lastName: true },
          },
          currency: { select: { code: true, symbol: true } },
        },
        orderBy: { expenseDate: 'desc' },
      }),
      this.prisma.expenseReport.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const report = await this.prisma.expenseReport.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            managerId: true,
          },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true },
        },
        currency: { select: { code: true, symbol: true } },
      },
    });
    if (!report) throw new NotFoundException('Expense report not found');
    return report;
  }

  async create(dto: CreateExpenseReportDto, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      select: { id: true, managerId: true },
    });
    if (!employee)
      throw new BadRequestException(
        'No employee record linked to your user account',
      );

    return this.prisma.expenseReport.create({
      data: {
        ...dto,
        employeeId: employee.id,
        approverId: employee.managerId,
        status: 'en_attente',
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true },
        },
        currency: { select: { code: true, symbol: true } },
      },
    });
  }

  async update(id: string, dto: UpdateExpenseReportDto, userId: string) {
    const report = await this.findOne(id);

    const employee = await this.prisma.employee.findFirst({
      where: { userId },
    });
    if (report.employeeId !== employee?.id) {
      throw new ForbiddenException(
        'You can only modify your own expense reports',
      );
    }
    if (report.status !== 'en_attente') {
      throw new BadRequestException(
        'Cannot modify an expense report that is not pending',
      );
    }

    return this.prisma.expenseReport.update({
      where: { id },
      data: dto,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true },
        },
        currency: { select: { code: true, symbol: true } },
      },
    });
  }

  async approve(id: string, dto: ApproveExpenseDto, userId: string) {
    const report = await this.findOne(id);

    if (report.status !== 'en_attente') {
      throw new BadRequestException(
        'This expense report is not pending approval',
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { userId },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { name: true } } },
    });

    const isApprover = employee && report.approverId === employee.id;
    const isPrivileged =
      user &&
      ['super_admin', 'comptable', 'gerant'].includes(user.role.name);

    if (!isApprover && !isPrivileged) {
      throw new ForbiddenException(
        'You are not authorized to approve this expense report',
      );
    }

    return this.prisma.expenseReport.update({
      where: { id },
      data: { status: dto.action },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async markReimbursed(id: string) {
    const report = await this.findOne(id);
    if (report.status !== 'approuve') {
      throw new BadRequestException(
        'Only approved expense reports can be marked as reimbursed',
      );
    }
    return this.prisma.expenseReport.update({
      where: { id },
      data: { status: 'rembourse' },
    });
  }

  async remove(id: string, userId: string) {
    const report = await this.findOne(id);
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
    });
    if (report.employeeId !== employee?.id) {
      throw new ForbiddenException(
        'You can only delete your own expense reports',
      );
    }
    if (report.status !== 'en_attente') {
      throw new BadRequestException(
        'Cannot delete an expense report that is not pending',
      );
    }
    return this.prisma.expenseReport.delete({ where: { id } });
  }

  async getStats(userId?: string) {
    const where = userId ? { employee: { userId } } : {};

    const [total, byStatus, sums] = await Promise.all([
      this.prisma.expenseReport.count({ where }),
      this.prisma.expenseReport.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.expenseReport.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const pendingApproval = await this.prisma.expenseReport.count({
      where: { status: 'en_attente' },
    });

    return {
      total,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        total: Number(s._sum.amount ?? 0),
      })),
      totalAmount: Number(sums._sum.amount ?? 0),
      pendingApproval,
    };
  }
}

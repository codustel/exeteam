import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: ListEmployeesDto) {
    const { page, limit, search, departmentId, contractType, managerId, isActive } = dto;
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(contractType ? { contractType } : {}),
      ...(managerId ? { managerId } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { professionalEmail: { contains: search, mode: 'insensitive' as const } },
          { position: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where, skip, take: limit,
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
          user: { select: { id: true, email: true, isActive: true } },
          _count: { select: { assignedTasks: true, leaveRequests: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id, deletedAt: null },
      include: {
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true } },
        subordinates: {
          where: { deletedAt: null, isActive: true },
          select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true },
        },
        user: { select: { id: true, email: true, isActive: true, role: { select: { name: true } } } },
        currency: { select: { code: true, symbol: true } },
        _count: { select: { assignedTasks: true, leaveRequests: true, timeEntries: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: dto,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    return this.prisma.employee.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async getOrgChart() {
    return this.prisma.employee.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true, firstName: true, lastName: true, position: true,
        photoUrl: true, managerId: true, departmentId: true,
        department: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }],
    });
  }

  async getStats() {
    const [total, active, onLeave] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.employee.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.leaveRequest.count({
        where: { status: 'approuve', startDate: { lte: new Date() }, endDate: { gte: new Date() } },
      }),
    ]);
    const tasksInProgress = await this.prisma.task.count({
      where: { status: 'en_cours', deletedAt: null, employeeId: { not: null } },
    });
    return {
      total, active, inactive: total - active, onLeave, tasksInProgress,
      avgTasksPerEmployee: active > 0 ? (tasksInProgress / active).toFixed(1) : '0',
    };
  }

  async getDepartments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  async createDepartment(name: string) {
    return this.prisma.department.create({ data: { name } });
  }

  async updateSalary(id: string, grossSalary: number, netSalary: number, currencyId?: string) {
    await this.findOne(id);
    await this.prisma.salary.create({ data: { employeeId: id, grossSalary, netSalary, effectiveDate: new Date() } });
    return this.prisma.employee.update({
      where: { id },
      data: { grossSalary, netSalary, ...(currencyId ? { currencyId } : {}) },
    });
  }

  async getSalaryHistory(employeeId: string) {
    return this.prisma.salary.findMany({ where: { employeeId }, orderBy: { effectiveDate: 'desc' } });
  }
}

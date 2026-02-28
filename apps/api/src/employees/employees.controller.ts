import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get('stats') @RequirePermissions('employees.read')
  getStats() { return this.employeesService.getStats(); }

  @Get('org-chart') @RequirePermissions('employees.read')
  getOrgChart() { return this.employeesService.getOrgChart(); }

  @Get('departments') @RequirePermissions('employees.read')
  getDepartments() { return this.employeesService.getDepartments(); }

  @Post('departments') @RequirePermissions('employees.create')
  createDepartment(@Body('name') name: string) { return this.employeesService.createDepartment(name); }

  @Get() @RequirePermissions('employees.read')
  findAll(@Query() dto: ListEmployeesDto) { return this.employeesService.findAll(dto); }

  @Get(':id') @RequirePermissions('employees.read')
  findOne(@Param('id') id: string) { return this.employeesService.findOne(id); }

  @Post() @RequirePermissions('employees.create')
  create(@Body() dto: CreateEmployeeDto) { return this.employeesService.create(dto); }

  @Patch(':id') @RequirePermissions('employees.update')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) { return this.employeesService.update(id, dto); }

  @Delete(':id') @RequirePermissions('employees.create')
  remove(@Param('id') id: string) { return this.employeesService.remove(id); }

  @Get(':id/salary-history') @RequirePermissions('hr.read_salaries')
  getSalaryHistory(@Param('id') id: string) { return this.employeesService.getSalaryHistory(id); }

  @Patch(':id/salary') @RequirePermissions('hr.update_salaries')
  updateSalary(
    @Param('id') id: string,
    @Body('grossSalary') grossSalary: number,
    @Body('netSalary') netSalary: number,
    @Body('currencyId') currencyId?: string,
  ) { return this.employeesService.updateSalary(id, grossSalary, netSalary, currencyId); }
}

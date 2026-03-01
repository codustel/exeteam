import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ExpenseReportsService } from './expense-reports.service';
import {
  CreateExpenseReportDto,
  UpdateExpenseReportDto,
  ApproveExpenseDto,
} from './dto/create-expense-report.dto';
import { ListExpenseReportsDto } from './dto/list-expense-reports.dto';

@Controller('expense-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpenseReportsController {
  constructor(private service: ExpenseReportsService) {}

  @Get('stats')
  @RequirePermissions('accounting.read')
  getStats(@Request() req: any) {
    return this.service.getStats(req.user?.id);
  }

  @Get()
  @RequirePermissions('accounting.read')
  findAll(@Query() dto: ListExpenseReportsDto) {
    return this.service.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('accounting.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('accounting.write')
  create(@Body() dto: CreateExpenseReportDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions('accounting.write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseReportDto,
    @Request() req: any,
  ) {
    return this.service.update(id, dto, req.user.id);
  }

  @Post(':id/approve')
  @RequirePermissions('accounting.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveExpenseDto,
    @Request() req: any,
  ) {
    return this.service.approve(id, dto, req.user.id);
  }

  @Patch(':id/reimburse')
  @RequirePermissions('accounting.write')
  markReimbursed(@Param('id') id: string) {
    return this.service.markReimbursed(id);
  }

  @Delete(':id')
  @RequirePermissions('accounting.write')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.id);
  }
}

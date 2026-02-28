import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto, ApproveLeaveDto } from './dto/create-leave.dto';
import { ListLeavesDto } from './dto/list-leaves.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/supabase.strategy';

@Controller('leaves')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeavesController {
  constructor(private leavesService: LeavesService) {}

  @Get('types') @RequirePermissions('leaves.read')
  getLeaveTypes() { return this.leavesService.getLeaveTypes(); }

  @Post('types') @RequirePermissions('leaves.approve')
  createLeaveType(
    @Body('name') name: string,
    @Body('daysPerYear') daysPerYear?: number,
    @Body('isCarryOver') isCarryOver?: boolean,
  ) { return this.leavesService.createLeaveType(name, daysPerYear, isCarryOver); }

  @Get() @RequirePermissions('leaves.read')
  findAll(@Query() dto: ListLeavesDto) { return this.leavesService.findAll(dto); }

  @Get(':id') @RequirePermissions('leaves.read')
  findOne(@Param('id') id: string) { return this.leavesService.findOne(id); }

  @Post() @RequirePermissions('leaves.create')
  create(@Body() dto: CreateLeaveDto) { return this.leavesService.create(dto); }

  @Patch(':id/approve') @RequirePermissions('leaves.approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: ApproveLeaveDto) {
    return this.leavesService.approve(id, user.employeeId!, dto);
  }

  @Patch(':id/refuse') @RequirePermissions('leaves.approve')
  refuse(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: ApproveLeaveDto) {
    return this.leavesService.refuse(id, user.employeeId!, dto);
  }

  @Patch(':id/cancel') @RequirePermissions('leaves.create')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.leavesService.cancel(id, user.employeeId!);
  }
}

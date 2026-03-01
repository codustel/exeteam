import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';
import { WeeklyTimesheetDto } from './dto/weekly-timesheet.dto';
import { MonthlyTimesheetDto } from './dto/monthly-timesheet.dto';
import { TeamTimesheetDto } from './dto/team-timesheet.dto';
import { ExportTimesheetDto } from './dto/export-timesheet.dto';
import { BulkValidateDto } from './dto/bulk-validate.dto';
import type { AuthUser } from '../auth/supabase.strategy';

interface RequestWithUser {
  user: AuthUser;
}

@Controller('time-entries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  @RequirePermissions('tasks.read')
  findAll(@Query() dto: ListTimeEntriesDto) {
    return this.timeEntriesService.findAll(dto);
  }

  // ── Timesheet endpoints (BEFORE :id routes) ──────────────────────

  @Get('weekly')
  @RequirePermissions('timesheets.read')
  getWeekly(@Query() dto: WeeklyTimesheetDto) {
    return this.timeEntriesService.getWeeklyTimesheet(dto);
  }

  @Get('monthly')
  @RequirePermissions('timesheets.read')
  getMonthly(@Query() dto: MonthlyTimesheetDto) {
    return this.timeEntriesService.getMonthlyTimesheet(dto);
  }

  @Get('team')
  @RequirePermissions('timesheets.validate')
  getTeam(@Query() dto: TeamTimesheetDto, @Req() req: RequestWithUser) {
    return this.timeEntriesService.getTeamTimesheet(dto, req.user.id);
  }

  @Get('export')
  @RequirePermissions('timesheets.export')
  async exportCsv(@Query() dto: ExportTimesheetDto, @Res() res: Response) {
    const result = await this.timeEntriesService.exportTimesheet(dto);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Patch('bulk-validate')
  @RequirePermissions('timesheets.validate')
  bulkValidate(@Body() dto: BulkValidateDto, @Req() req: RequestWithUser) {
    return this.timeEntriesService.bulkValidate(dto, req.user.id);
  }

  // ── Standard CRUD (after static routes) ──────────────────────────

  @Get(':id')
  @RequirePermissions('tasks.read')
  findOne(@Param('id') id: string) {
    return this.timeEntriesService.findOne(id);
  }

  @Post()
  @RequirePermissions('tasks.update')
  create(@Body() dto: CreateTimeEntryDto, @Req() req: RequestWithUser) {
    return this.timeEntriesService.create(dto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions('tasks.update')
  update(@Param('id') id: string, @Body() dto: UpdateTimeEntryDto) {
    return this.timeEntriesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tasks.update')
  remove(@Param('id') id: string) {
    return this.timeEntriesService.remove(id);
  }

  @Patch(':id/validate')
  @RequirePermissions('tasks.update')
  validate(@Param('id') id: string) {
    return this.timeEntriesService.validate(id);
  }
}

import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';
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

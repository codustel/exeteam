import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { AddDeliverableDto } from './dto/add-deliverable.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import type { AuthUser } from '../auth/supabase.strategy';

interface RequestWithUser {
  user: AuthUser;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('stats')
  @RequirePermissions('tasks.read')
  getStats() {
    return this.tasksService.getStats();
  }

  @Get()
  @RequirePermissions('tasks.read')
  findAll(@Query() dto: ListTasksDto) {
    return this.tasksService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('tasks.read')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @RequirePermissions('tasks.create')
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tasks.update')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req: RequestWithUser) {
    return this.tasksService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions('tasks.delete')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  @Post(':id/deliverables')
  @RequirePermissions('tasks.update')
  addDeliverable(@Param('id') id: string, @Body() dto: AddDeliverableDto) {
    return this.tasksService.addDeliverable(id, dto);
  }

  @Delete(':id/deliverables/:deliverableId')
  @RequirePermissions('tasks.update')
  removeDeliverable(
    @Param('id') id: string,
    @Param('deliverableId') deliverableId: string,
  ) {
    return this.tasksService.removeDeliverable(id, deliverableId);
  }

  @Post(':id/comments')
  @RequirePermissions('tasks.update')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tasksService.addComment(id, dto, req.user.id);
  }

  @Delete(':id/comments/:commentId')
  @RequirePermissions('tasks.update')
  deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.tasksService.deleteComment(id, commentId, req.user.id);
  }
}

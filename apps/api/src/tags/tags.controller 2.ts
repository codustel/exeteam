import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('tags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Get()
  @RequirePermissions('tags.create')
  findAll() { return this.tagsService.findAll(); }

  @Post()
  @RequirePermissions('tags.create')
  create(@Body('name') name: string, @Body('color') color?: string) {
    return this.tagsService.create(name, color);
  }

  @Patch(':id')
  @RequirePermissions('tags.update')
  update(@Param('id') id: string, @Body('name') name?: string, @Body('color') color?: string) {
    return this.tagsService.update(id, name, color);
  }

  @Delete(':id')
  @RequirePermissions('tags.delete')
  remove(@Param('id') id: string) { return this.tagsService.remove(id); }
}

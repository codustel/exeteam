import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto, UpdateTagDto } from './dto/create-tag.dto';
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
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto.name, dto.color);
  }

  @Patch(':id')
  @RequirePermissions('tags.update')
  update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, dto.name, dto.color);
  }

  @Delete(':id')
  @RequirePermissions('tags.delete')
  remove(@Param('id') id: string) { return this.tagsService.remove(id); }
}

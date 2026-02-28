import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto/create-site.dto';
import { ListSitesDto } from './dto/list-sites.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('sites')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SitesController {
  constructor(private sitesService: SitesService) {}

  @Get('typologies')
  @RequirePermissions('sites.read')
  getTypologies() { return this.sitesService.getTypologies(); }

  @Get('stats')
  @RequirePermissions('sites.read')
  getStats() { return this.sitesService.getStats(); }

  @Get()
  @RequirePermissions('sites.read')
  findAll(@Query() dto: ListSitesDto) { return this.sitesService.findAll(dto); }

  @Get(':id')
  @RequirePermissions('sites.read')
  findOne(@Param('id') id: string) { return this.sitesService.findOne(id); }

  @Post()
  @RequirePermissions('sites.create')
  create(@Body() dto: CreateSiteDto) { return this.sitesService.create(dto); }

  @Patch(':id')
  @RequirePermissions('sites.update')
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.sitesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('sites.delete')
  remove(@Param('id') id: string) { return this.sitesService.remove(id); }
}

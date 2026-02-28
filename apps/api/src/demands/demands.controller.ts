import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { DemandsService } from './demands.service';
import { CreateDemandDto } from './dto/create-demand.dto';
import { UpdateDemandDto } from './dto/update-demand.dto';
import { ListDemandsDto } from './dto/list-demands.dto';
import type { AuthUser } from '../auth/supabase.strategy';

@Controller('demands')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DemandsController {
  constructor(private readonly demandsService: DemandsService) {}

  @Get('stats')
  @RequirePermissions('demands.read')
  getStats() {
    return this.demandsService.getStats();
  }

  @Get()
  @RequirePermissions('demands.read')
  findAll(@Query() dto: ListDemandsDto) {
    return this.demandsService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('demands.read')
  findOne(@Param('id') id: string) {
    return this.demandsService.findOne(id);
  }

  @Post()
  @RequirePermissions('demands.create')
  create(@Body() dto: CreateDemandDto, @Request() req: { user: AuthUser }) {
    return this.demandsService.create(dto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions('demands.update')
  update(@Param('id') id: string, @Body() dto: UpdateDemandDto) {
    return this.demandsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('demands.delete')
  remove(@Param('id') id: string) {
    return this.demandsService.remove(id);
  }

  @Post(':id/convert-to-task')
  @RequirePermissions('demands.update')
  convertToTask(@Param('id') id: string) {
    return this.demandsService.convertToTask(id);
  }
}

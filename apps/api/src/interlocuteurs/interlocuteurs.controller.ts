import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { InterlocuteursService } from './interlocuteurs.service';
import { CreateInterlocuteurDto, UpdateInterlocuteurDto } from './dto/create-interlocuteur.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('interlocuteurs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InterlocuteursController {
  constructor(private interlocuteursService: InterlocuteursService) {}

  @Get()
  @RequirePermissions('clients.read')
  findByClient(@Query('clientId') clientId: string) {
    return this.interlocuteursService.findByClient(clientId);
  }

  @Get(':id')
  @RequirePermissions('clients.read')
  findOne(@Param('id') id: string) { return this.interlocuteursService.findOne(id); }

  @Post()
  @RequirePermissions('clients.create')
  create(@Body() dto: CreateInterlocuteurDto) { return this.interlocuteursService.create(dto); }

  @Patch(':id')
  @RequirePermissions('clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateInterlocuteurDto) {
    return this.interlocuteursService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  remove(@Param('id') id: string) { return this.interlocuteursService.remove(id); }
}

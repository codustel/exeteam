import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { OperatorsService } from './operators.service';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/create-operator.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('operators')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OperatorsController {
  constructor(private operatorsService: OperatorsService) {}

  @Get()
  @RequirePermissions('clients.read')
  findAll(@Query('search') search?: string) { return this.operatorsService.findAll(search); }

  @Get(':id')
  @RequirePermissions('clients.read')
  findOne(@Param('id') id: string) { return this.operatorsService.findOne(id); }

  @Post()
  @RequirePermissions('clients.create')
  create(@Body() dto: CreateOperatorDto) { return this.operatorsService.create(dto); }

  @Patch(':id')
  @RequirePermissions('clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateOperatorDto) {
    return this.operatorsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  remove(@Param('id') id: string) { return this.operatorsService.remove(id); }
}

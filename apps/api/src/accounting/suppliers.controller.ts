import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersDto } from './dto/list-suppliers.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private service: SuppliersService) {}

  @Get('stats')
  @RequirePermissions('accounting.read')
  getStats() {
    return this.service.getStats();
  }

  @Get()
  @RequirePermissions('accounting.read')
  findAll(@Query() dto: ListSuppliersDto) {
    return this.service.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('accounting.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('accounting.write')
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('accounting.write')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('accounting.write')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

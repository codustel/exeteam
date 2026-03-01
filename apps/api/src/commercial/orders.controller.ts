import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('commercial/orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('commercial.read')
  findAll(@Query() q: any) { return this.ordersService.findAll(q); }

  @Get(':id')
  @RequirePermissions('commercial.read')
  findOne(@Param('id') id: string) { return this.ordersService.findOne(id); }

  @Post()
  @RequirePermissions('commercial.create')
  create(@Body() dto: CreateOrderDto) { return this.ordersService.create(dto); }

  @Patch(':id')
  @RequirePermissions('commercial.update')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('commercial.delete')
  remove(@Param('id') id: string) { return this.ordersService.remove(id); }
}

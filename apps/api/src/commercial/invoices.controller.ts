import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('commercial/invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('commercial.read')
  findAll(@Query() q: any) { return this.invoicesService.findAll(q); }

  @Get(':id')
  @RequirePermissions('commercial.read')
  findOne(@Param('id') id: string) { return this.invoicesService.findOne(id); }

  @Post()
  @RequirePermissions('commercial.create')
  create(@Body() dto: CreateInvoiceDto) { return this.invoicesService.create(dto); }

  @Patch(':id')
  @RequirePermissions('commercial.update')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, dto);
  }

  @Patch(':id/payment')
  @RequirePermissions('commercial.update')
  recordPayment(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.invoicesService.recordPayment(id, body.amount);
  }

  @Delete(':id')
  @RequirePermissions('commercial.delete')
  remove(@Param('id') id: string) { return this.invoicesService.remove(id); }
}

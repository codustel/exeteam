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
import { PurchaseInvoicesService } from './purchase-invoices.service';
import {
  CreatePurchaseInvoiceDto,
  UpdatePurchaseInvoiceDto,
} from './dto/create-purchase-invoice.dto';
import { ListPurchaseInvoicesDto } from './dto/list-purchase-invoices.dto';

@Controller('purchase-invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseInvoicesController {
  constructor(private service: PurchaseInvoicesService) {}

  @Get('stats')
  @RequirePermissions('accounting.read')
  getStats() {
    return this.service.getStats();
  }

  @Get()
  @RequirePermissions('accounting.read')
  findAll(@Query() dto: ListPurchaseInvoicesDto) {
    return this.service.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('accounting.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('accounting.write')
  create(@Body() dto: CreatePurchaseInvoiceDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('accounting.write')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseInvoiceDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/file')
  @RequirePermissions('accounting.write')
  attachFile(@Param('id') id: string, @Body('fileUrl') fileUrl: string) {
    return this.service.attachFile(id, fileUrl);
  }

  @Delete(':id')
  @RequirePermissions('accounting.write')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

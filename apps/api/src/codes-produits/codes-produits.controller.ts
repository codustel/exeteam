import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { CodesProduitsService } from './codes-produits.service';
import { CreateCodeProduitDto, UpdateCodeProduitDto } from './dto/create-code-produit.dto';
import { ListCodesProduitsDto } from './dto/list-codes-produits.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('codes-produits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CodesProduitsController {
  constructor(private codesProduitsService: CodesProduitsService) {}

  @Get()
  @RequirePermissions('clients.read')
  findAll(@Query() dto: ListCodesProduitsDto) { return this.codesProduitsService.findAll(dto); }

  @Get(':id')
  @RequirePermissions('clients.read')
  findOne(@Param('id') id: string) { return this.codesProduitsService.findOne(id); }

  @Post()
  @RequirePermissions('clients.create')
  create(@Body() dto: CreateCodeProduitDto) { return this.codesProduitsService.create(dto); }

  @Patch(':id')
  @RequirePermissions('clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateCodeProduitDto) {
    return this.codesProduitsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  remove(@Param('id') id: string) { return this.codesProduitsService.remove(id); }
}

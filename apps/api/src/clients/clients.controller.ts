import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get('stats')
  @RequirePermissions('clients.read')
  getStats() { return this.clientsService.getStats(); }

  @Get()
  @RequirePermissions('clients.read')
  findAll(@Query() dto: ListClientsDto) { return this.clientsService.findAll(dto); }

  @Get(':id')
  @RequirePermissions('clients.read')
  findOne(@Param('id') id: string) { return this.clientsService.findOne(id); }

  @Post()
  @RequirePermissions('clients.create')
  create(@Body() dto: CreateClientDto) { return this.clientsService.create(dto); }

  @Patch(':id')
  @RequirePermissions('clients.update')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  remove(@Param('id') id: string) { return this.clientsService.remove(id); }

  @Post(':id/logo')
  @RequirePermissions('clients.update')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(@Param('id') id: string, @UploadedFile() file: any) {
    // Logo upload is handled client-side via Supabase Storage signed URL
    // This endpoint receives the public URL after upload and stores it
    return this.clientsService.updateLogo(id, file.originalname);
  }

  @Patch(':id/logo-url')
  @RequirePermissions('clients.update')
  updateLogoUrl(@Param('id') id: string, @Body('logoUrl') logoUrl: string) {
    return this.clientsService.updateLogo(id, logoUrl);
  }
}

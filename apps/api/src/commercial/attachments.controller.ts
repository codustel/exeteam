import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { ListAttachmentsDto } from './dto/list-attachments.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('commercial/attachments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Get('stats')
  @RequirePermissions('commercial.read')
  getStats() { return this.attachmentsService.getStats(); }

  @Get('facturable-tasks')
  @RequirePermissions('commercial.read')
  getFacturableTasks(@Query('clientId') clientId: string, @Query('period') period: string) {
    return this.attachmentsService.getFacturableTasks(clientId, period);
  }

  @Get()
  @RequirePermissions('commercial.read')
  findAll(@Query() dto: ListAttachmentsDto) { return this.attachmentsService.findAll(dto); }

  @Get(':id')
  @RequirePermissions('commercial.read')
  findOne(@Param('id') id: string) { return this.attachmentsService.findOne(id); }

  @Post()
  @RequirePermissions('commercial.create')
  create(@Body() dto: CreateAttachmentDto) { return this.attachmentsService.create(dto); }

  @Patch(':id/status')
  @RequirePermissions('commercial.update')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.attachmentsService.updateStatus(id, body.status);
  }
}

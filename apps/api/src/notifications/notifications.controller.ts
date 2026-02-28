import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import type { AuthUser } from '../auth/supabase.strategy';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  findAll(@Request() req: { user: AuthUser }, @Query() dto: ListNotificationsDto) {
    return this.notificationsService.findAllForUser(req.user.id, dto);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  getUnreadCount(@Request() req: { user: AuthUser }) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  markRead(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  markAllRead(@Request() req: { user: AuthUser }) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  /**
   * Internal service-to-service endpoint, protected by API key header.
   * No JWT guard — called by internal services or workers.
   */
  @Post()
  createInternal(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: CreateNotificationDto,
  ) {
    const expected = this.config.get<string>('INTERNAL_API_KEY');
    if (!expected || apiKey !== expected) {
      throw new ForbiddenException('Invalid API key');
    }
    return this.notificationsService.create(dto);
  }
}

import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PushService, PushSubscriptionData } from './push.service';
import type { AuthUser } from '../auth/supabase.strategy';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('public-key')
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(
    @Request() req: { user: AuthUser },
    @Body() body: { subscription: PushSubscriptionData },
  ) {
    return this.pushService.subscribe(req.user.id, body.subscription);
  }

  @Post('unsubscribe')
  @UseGuards(JwtAuthGuard)
  unsubscribe(
    @Request() req: { user: AuthUser },
    @Body() body: { endpoint: string },
  ) {
    return this.pushService.unsubscribe(req.user.id, body.endpoint);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  sendToSelf(
    @Request() req: { user: AuthUser },
    @Body() body: { title: string; body?: string; link?: string },
  ) {
    return this.pushService.sendToUser(req.user.id, body);
  }
}

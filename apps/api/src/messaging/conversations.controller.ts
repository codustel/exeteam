import {
  Controller, Get, Post, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.conversationsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.findOne(id, req.user.sub);
  }

  @Post()
  create(@Body() dto: CreateConversationDto, @Request() req: any) {
    return this.conversationsService.create(dto, req.user.sub);
  }

  @Get(':id/messages')
  getMessages(
    @Param('id') id: string,
    @Request() req: any,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.getMessages(id, req.user.sub, before, limit ? parseInt(limit, 10) : 50);
  }

  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @Request() req: any) {
    return this.conversationsService.sendMessage(id, dto, req.user.sub);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.markMessagesRead(id, req.user.sub);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: { employeeId: string }) {
    return this.conversationsService.addMember(id, body.employeeId);
  }

  @Post('direct/:employeeId')
  findOrCreateDirect(@Param('employeeId') employeeId: string, @Request() req: any) {
    return this.conversationsService.findOrCreateDirect(req.user.sub, employeeId);
  }
}

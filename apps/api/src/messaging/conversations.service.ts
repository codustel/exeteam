import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  // Get all conversations for the current user (via their employee record)
  async findAll(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) return [];

    return this.prisma.conversation.findMany({
      where: {
        members: { some: { employeeId: employee.id } },
      },
      include: {
        members: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, userId: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, email: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, userId: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: {
            sender: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    // Check membership
    if (employee) {
      const isMember = conversation.members.some(m => m.employeeId === employee.id);
      if (!isMember) throw new ForbiddenException('Not a member of this conversation');
    }

    return conversation;
  }

  async create(dto: CreateConversationDto, userId: string) {
    // Find the creating user's employee record
    const creator = await this.prisma.employee.findUnique({ where: { userId } });

    // Build member list (include creator if not already in list)
    const memberIds = [...new Set([
      ...(creator ? [creator.id] : []),
      ...dto.memberEmployeeIds,
    ])];

    return this.prisma.conversation.create({
      data: {
        name: dto.name,
        isGroup: dto.isGroup,
        members: {
          create: memberIds.map(employeeId => ({ employeeId })),
        },
      },
      include: {
        members: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async sendMessage(conversationId: string, dto: SendMessageDto, senderId: string) {
    // Verify conversation exists (membership checked at controller level via findOne)
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: dto.content,
        fileUrl: dto.fileUrl,
      },
      include: {
        sender: { select: { id: true, email: true } },
      },
    });

    // Update conversation updatedAt for sort order
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(conversationId: string, userId: string, before?: string, limit = 50) {
    await this.findOne(conversationId, userId); // validates membership

    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: {
        sender: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markMessagesRead(conversationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
  }

  async addMember(conversationId: string, employeeId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (!conv.isGroup) throw new ForbiddenException('Cannot add members to a direct conversation');

    return this.prisma.conversationMember.upsert({
      where: { conversationId_employeeId: { conversationId, employeeId } },
      create: { conversationId, employeeId },
      update: {},
    });
  }

  async removeMember(conversationId: string, employeeId: string) {
    return this.prisma.conversationMember.delete({
      where: { conversationId_employeeId: { conversationId, employeeId } },
    });
  }

  // Find or create a direct conversation between two employees
  async findOrCreateDirect(userId: string, targetEmployeeId: string) {
    const creator = await this.prisma.employee.findUnique({ where: { userId } });
    if (!creator) throw new ForbiddenException('No employee linked to this user');

    // Look for an existing direct conversation with exactly these 2 members
    const existing = await this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: {
          every: { employeeId: { in: [creator.id, targetEmployeeId] } },
        },
        AND: [
          { members: { some: { employeeId: creator.id } } },
          { members: { some: { employeeId: targetEmployeeId } } },
        ],
      },
      include: {
        members: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        isGroup: false,
        members: {
          create: [
            { employeeId: creator.id },
            { employeeId: targetEmployeeId },
          ],
        },
      },
      include: {
        members: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }
}

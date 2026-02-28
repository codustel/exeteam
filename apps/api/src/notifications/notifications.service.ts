import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string, dto: ListNotificationsDto) {
    const { page, limit, isRead } = dto;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(isRead !== undefined ? { isRead } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    if (notification.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        link: dto.link,
      },
    });
  }

  /**
   * Convenience method for internal use by other NestJS services.
   * Does not require HTTP context.
   */
  async emit(params: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: params,
    });
  }

  /**
   * Emit a notification to every user who has a specific permission.
   * Permission format: "module.action" (e.g. "demands.manage")
   */
  async emitToPermission(params: {
    permission: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }) {
    // Split "module.action" permission string
    const [module, action] = params.permission.split('.');

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { permission: { module, action } },
      include: { role: true },
    });

    if (rolePermissions.length === 0) return;

    const roleIds = rolePermissions.map((rp) => rp.roleId);

    const users = await this.prisma.user.findMany({
      where: { roleId: { in: roleIds }, deletedAt: null },
      select: { id: true },
    });

    if (users.length === 0) return;

    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
      })),
    });
  }
}

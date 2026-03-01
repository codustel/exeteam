import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class RgpdService {
  constructor(private readonly prisma: PrismaService) {}

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: true,
        interlocuteur: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const employeeId = user.employee?.id;

    const [timeEntries, leaveRequests, comments, messages, notifications] = await Promise.all([
      employeeId
        ? this.prisma.timeEntry.findMany({ where: { employeeId } })
        : [],
      employeeId
        ? this.prisma.leaveRequest.findMany({ where: { employeeId } })
        : [],
      this.prisma.taskComment.findMany({ where: { authorId: userId } }),
      this.prisma.message.findMany({ where: { senderId: userId } }),
      this.prisma.notification.findMany({ where: { userId } }),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      employee: user.employee,
      interlocuteur: user.interlocuteur,
      timeEntries,
      leaveRequests,
      comments,
      messages,
      notifications,
      exportedAt: new Date().toISOString(),
    };
  }

  async anonymizeUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const anonId = randomUUID().substring(0, 8);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `anon_${anonId}@deleted.local`,
        isActive: false,
      },
    });

    // Anonymize linked employee if exists
    if (user.employee) {
      await this.prisma.employee.update({
        where: { id: user.employee.id },
        data: {
          firstName: 'Anonyme',
          lastName: 'Utilisateur',
          professionalEmail: `anon_${anonId}@deleted.local`,
          personalEmail: null,
          phone: null,
        },
      });
    }

    return { success: true, message: 'User data anonymized successfully' };
  }
}

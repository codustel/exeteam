import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private supabase;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.supabase = createClient(
      config.get('SUPABASE_URL')!,
      config.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  async inviteUser(email: string, roleId: string, associateEmployeeId?: string, associateInterlocuteurId?: string): Promise<unknown> {
    // Create Supabase Auth user via admin invite
    const { data, error } = await this.supabase.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(error.message);

    const supabaseUserId = data.user.id;

    // Create User in our DB
    const user = await this.prisma.user.create({
      data: {
        id: supabaseUserId,
        email,
        roleId,
        ...(associateEmployeeId
          ? { employee: { connect: { id: associateEmployeeId } } }
          : {}),
        ...(associateInterlocuteurId
          ? { interlocuteur: { connect: { id: associateInterlocuteurId } } }
          : {}),
      },
      include: { role: true, employee: true, interlocuteur: true },
    });

    return user;
  }

  async deactivateUser(userId: string) {
    await this.supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  async updateUserRole(userId: string, roleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });
  }
}

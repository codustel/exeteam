import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;       // Supabase user UUID
  email: string;
  role: string;      // Supabase role (authenticated)
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  employeeId: string | null;
  interlocuteurId: string | null;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Supabase JWT secret from dashboard → Settings → API → JWT Secret
      secretOrKey: config.get<string>('SUPABASE_JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        employee: { select: { id: true } },
        interlocuteur: { select: { id: true } },
      },
    });

    if (!user) throw new UnauthorizedException('User not found or inactive');

    const permissions = user.role.permissions.map(
      (rp) => `${rp.permission.module}.${rp.permission.action}`,
    );

    return {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions,
      employeeId: user.employee?.id ?? null,
      interlocuteurId: user.interlocuteur?.id ?? null,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        role: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        interlocuteur: {
          select: { id: true, firstName: true, lastName: true, client: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<unknown> {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: { role: true, employee: true, interlocuteur: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto): Promise<unknown> {
    return this.authService.inviteUser(
      dto.email,
      dto.roleId,
      dto.associateEmployeeId,
      dto.associateInterlocuteurId,
    );
  }

  async updateRole(id: string, roleId: string) {
    return this.authService.updateUserRole(id, roleId);
  }

  async deactivate(id: string) {
    return this.authService.deactivateUser(id);
  }
}

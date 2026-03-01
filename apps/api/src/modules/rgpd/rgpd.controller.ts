import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { RgpdService } from './rgpd.service';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('rgpd')
@UseGuards(JwtAuthGuard)
export class RgpdController {
  constructor(private readonly rgpdService: RgpdService) {}

  @Get('export/:userId')
  async exportUserData(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    // Users can export their own data, or super_admin/gerant can export any user
    if (currentUser.id !== userId && !['super_admin', 'gerant'].includes(currentUser.roleName)) {
      throw new Error('Unauthorized');
    }
    return this.rgpdService.exportUserData(userId);
  }

  @Delete('anonymize/:userId')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  async anonymizeUser(@Param('userId') userId: string) {
    return this.rgpdService.anonymizeUser(userId);
  }
}

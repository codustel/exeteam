import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { PublicHolidaysService } from './public-holidays.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('public-holidays')
@UseGuards(JwtAuthGuard)
export class PublicHolidaysController {
  constructor(private publicHolidaysService: PublicHolidaysService) {}

  @Get()
  findAll(@Query('year') year?: string, @Query('country') country?: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.publicHolidaysService.findAll(y, country ?? 'FR');
  }

  @Post('sync/:year')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'gerant')
  syncYear(@Param('year') year: string, @Query('country') country?: string) {
    return this.publicHolidaysService.syncFromNager(parseInt(year, 10), country ?? 'FR');
  }
}

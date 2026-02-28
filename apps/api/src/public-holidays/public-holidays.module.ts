import { Module } from '@nestjs/common';
import { PublicHolidaysController } from './public-holidays.controller';
import { PublicHolidaysService } from './public-holidays.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PublicHolidaysController],
  providers: [PublicHolidaysService],
  exports: [PublicHolidaysService],
})
export class PublicHolidaysModule {}

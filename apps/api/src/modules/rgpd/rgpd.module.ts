import { Module } from '@nestjs/common';
import { RgpdController } from './rgpd.controller';
import { RgpdService } from './rgpd.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RgpdController],
  providers: [RgpdService],
})
export class RgpdModule {}

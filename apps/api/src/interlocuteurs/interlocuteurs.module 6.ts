import { Module } from '@nestjs/common';
import { InterlocuteursController } from './interlocuteurs.controller';
import { InterlocuteursService } from './interlocuteurs.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InterlocuteursController],
  providers: [InterlocuteursService],
  exports: [InterlocuteursService],
})
export class InterlocuteursModule {}

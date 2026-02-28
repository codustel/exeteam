import { Module } from '@nestjs/common';
import { CodesProduitsController } from './codes-produits.controller';
import { CodesProduitsService } from './codes-produits.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CodesProduitsController],
  providers: [CodesProduitsService],
  exports: [CodesProduitsService],
})
export class CodesProduitsModule {}

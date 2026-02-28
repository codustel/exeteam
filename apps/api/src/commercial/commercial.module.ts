import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AttachmentsController, QuotesController, InvoicesController],
  providers: [AttachmentsService, QuotesService, InvoicesService],
  exports: [AttachmentsService, QuotesService, InvoicesService],
})
export class CommercialModule {}

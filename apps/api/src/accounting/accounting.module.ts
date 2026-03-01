import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { PurchaseInvoicesController } from './purchase-invoices.controller';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { ExpenseReportsController } from './expense-reports.controller';
import { ExpenseReportsService } from './expense-reports.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    SuppliersController,
    PurchaseInvoicesController,
    ExpenseReportsController,
  ],
  providers: [
    SuppliersService,
    PurchaseInvoicesService,
    ExpenseReportsService,
  ],
  exports: [SuppliersService, PurchaseInvoicesService, ExpenseReportsService],
})
export class AccountingModule {}

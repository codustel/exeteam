export interface SupplierSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vatNumber: string | null;
  siret: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { purchaseInvoices: number };
}

export interface PurchaseInvoiceSummary {
  id: string;
  reference: string;
  supplierId: string;
  supplier: { id: string; name: string };
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  totalHt: number;
  vatAmount: number;
  totalTtc: number;
  amountPaid: number;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseReportSummary {
  id: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string };
  approverId: string | null;
  approver: { id: string; firstName: string; lastName: string } | null;
  title: string;
  description: string | null;
  amount: number;
  vatAmount: number | null;
  status: string;
  expenseDate: string;
  receiptUrl: string | null;
  currency: { code: string; symbol: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Standard VAT rates for France */
export const VAT_RATES = [
  { label: 'TVA 20%', value: 20 },
  { label: 'TVA 10%', value: 10 },
  { label: 'TVA 5.5%', value: 5.5 },
  { label: 'TVA 2.1%', value: 2.1 },
  { label: 'Exonéré', value: 0 },
] as const;
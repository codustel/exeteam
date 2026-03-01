import { apiRequest } from './client';
import type {
  SupplierSummary,
  PurchaseInvoiceSummary,
  ExpenseReportSummary,
} from '@exeteam/shared';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}

// ── Suppliers ──
export const suppliersApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    apiRequest<PaginatedResponse<SupplierSummary>>(`/suppliers?${toQueryString(params)}`),

  getStats: () =>
    apiRequest<{ total: number; active: number; inactive: number; totalPurchaseHt: number }>(
      '/suppliers/stats',
    ),

  get: (id: string) => apiRequest<SupplierSummary>(`/suppliers/${id}`),

  create: (data: Record<string, unknown>) =>
    apiRequest<SupplierSummary>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<SupplierSummary>(`/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    apiRequest(`/suppliers/${id}`, { method: 'DELETE' }),
};

// ── Purchase Invoices ──
export const purchaseInvoicesApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    apiRequest<PaginatedResponse<PurchaseInvoiceSummary>>(
      `/purchase-invoices?${toQueryString(params)}`,
    ),

  getStats: () =>
    apiRequest<{
      total: number;
      byStatus: { status: string; count: number }[];
      totalHt: number;
      totalTtc: number;
      amountPaid: number;
      amountDue: number;
      overdue: number;
    }>('/purchase-invoices/stats'),

  get: (id: string) =>
    apiRequest<PurchaseInvoiceSummary>(`/purchase-invoices/${id}`),

  create: (data: Record<string, unknown>) =>
    apiRequest<PurchaseInvoiceSummary>('/purchase-invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<PurchaseInvoiceSummary>(`/purchase-invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  attachFile: (id: string, fileUrl: string) =>
    apiRequest(`/purchase-invoices/${id}/file`, {
      method: 'PATCH',
      body: JSON.stringify({ fileUrl }),
    }),

  remove: (id: string) =>
    apiRequest(`/purchase-invoices/${id}`, { method: 'DELETE' }),
};

// ── Expense Reports ──
export const expenseReportsApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    apiRequest<PaginatedResponse<ExpenseReportSummary>>(
      `/expense-reports?${toQueryString(params)}`,
    ),

  getStats: () =>
    apiRequest<{
      total: number;
      byStatus: { status: string; count: number; total: number }[];
      totalAmount: number;
      pendingApproval: number;
    }>('/expense-reports/stats'),

  get: (id: string) =>
    apiRequest<ExpenseReportSummary>(`/expense-reports/${id}`),

  create: (data: Record<string, unknown>) =>
    apiRequest<ExpenseReportSummary>('/expense-reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<ExpenseReportSummary>(`/expense-reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  approve: (id: string, data: { action: string; comment?: string }) =>
    apiRequest(`/expense-reports/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reimburse: (id: string) =>
    apiRequest(`/expense-reports/${id}/reimburse`, { method: 'PATCH' }),

  remove: (id: string) =>
    apiRequest(`/expense-reports/${id}`, { method: 'DELETE' }),
};

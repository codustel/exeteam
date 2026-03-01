import { apiRequest } from './client';
import type {
  GeneralDashboard,
  ProductionDashboard,
  FinancierDashboard,
  ClientDashboard,
  EmployeeDashboard,
  RentabiliteDashboard,
  DashboardExportType,
} from '@exeteam/shared';

export type { GeneralDashboard, ProductionDashboard, FinancierDashboard, ClientDashboard, EmployeeDashboard, RentabiliteDashboard };

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, String(value));
    }
  }
  return q.toString() ? `?${q.toString()}` : '';
}

export const dashboardApi = {
  getGeneral: () =>
    apiRequest<GeneralDashboard>('/dashboard/general'),

  getProduction: (params: {
    startDate?: string;
    endDate?: string;
    operatorId?: string;
    clientId?: string;
  } = {}) =>
    apiRequest<ProductionDashboard>(`/dashboard/production${toQuery(params)}`),

  getFinancier: (params: { year?: number; month?: number } = {}) =>
    apiRequest<FinancierDashboard>(`/dashboard/financier${toQuery(params)}`),

  getClient: (clientId: string) =>
    apiRequest<ClientDashboard>(`/dashboard/client/${clientId}`),

  getEmployee: (employeeId: string) =>
    apiRequest<EmployeeDashboard>(`/dashboard/employe/${employeeId}`),

  getRentabilite: (params: { year?: number; month?: number } = {}) =>
    apiRequest<RentabiliteDashboard>(`/dashboard/rentabilite-salariale${toQuery(params)}`),

  export: async (params: {
    type: DashboardExportType;
    startDate?: string;
    endDate?: string;
    format?: 'xlsx';
  }): Promise<Blob> => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const qs = toQuery({ ...params, format: 'xlsx' });

    const res = await fetch(`${API_URL}/dashboard/export${qs}`, {
      headers: {
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
      },
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
};

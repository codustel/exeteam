import { apiRequest } from './client';

export const attachmentsApi = {
  list: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<any>(`/commercial/attachments?${qs}`);
  },
  getOne: (id: string) => apiRequest<any>(`/commercial/attachments/${id}`),
  getStats: () => apiRequest<any>('/commercial/attachments/stats'),
  getFacturableTasks: (clientId: string, period: string) =>
    apiRequest<any[]>(`/commercial/attachments/facturable-tasks?clientId=${clientId}&period=${period}`),
  create: (data: Record<string, unknown>) =>
    apiRequest<any>('/commercial/attachments', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    apiRequest(`/commercial/attachments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const quotesApi = {
  list: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return apiRequest<any>(`/commercial/quotes?${qs}`);
  },
  getOne: (id: string) => apiRequest<any>(`/commercial/quotes/${id}`),
  create: (data: Record<string, unknown>) =>
    apiRequest<any>('/commercial/quotes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/commercial/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest(`/commercial/quotes/${id}`, { method: 'DELETE' }),
};

export const invoicesApi = {
  list: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return apiRequest<any>(`/commercial/invoices?${qs}`);
  },
  getOne: (id: string) => apiRequest<any>(`/commercial/invoices/${id}`),
  create: (data: Record<string, unknown>) =>
    apiRequest<any>('/commercial/invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/commercial/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  recordPayment: (id: string, amount: number) =>
    apiRequest(`/commercial/invoices/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ amount }) }),
  delete: (id: string) => apiRequest(`/commercial/invoices/${id}`, { method: 'DELETE' }),
};

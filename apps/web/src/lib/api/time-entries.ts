import { apiRequest } from './client';
import type { TimeEntryItem } from './tasks';

export interface TimeEntryListResponse {
  data: TimeEntryItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

type TimeEntryParams = {
  page?: number;
  limit?: number;
  taskId?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  isValidated?: boolean;
};

export const timeEntriesApi = {
  list: (params: TimeEntryParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<TimeEntryListResponse>(`/time-entries?${qs}`);
  },

  getOne: (id: string) => apiRequest<TimeEntryItem>(`/time-entries/${id}`),

  create: (data: { taskId: string; employeeId: string; date: string; hours: number; comment?: string }) =>
    apiRequest<TimeEntryItem>('/time-entries', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { date?: string; hours?: number; comment?: string }) =>
    apiRequest<TimeEntryItem>(`/time-entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/time-entries/${id}`, { method: 'DELETE' }),

  validate: (id: string) =>
    apiRequest<TimeEntryItem>(`/time-entries/${id}/validate`, { method: 'PATCH' }),
};

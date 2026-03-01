import { apiRequest } from './client';

export interface LeaveType {
  id: string;
  name: string;
  color: string;
}

export interface LeaveListItem {
  id: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string };
  leaveTypeId: string;
  leaveType: { id: string; name: string; color: string };
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string | null;
  approverId: string | null;
  approver: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface LeaveListResponse {
  data: LeaveListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const leavesApi = {
  list: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<LeaveListResponse>(`/leaves?${qs}`);
  },

  getOne: (id: string) => apiRequest<LeaveListItem>(`/leaves/${id}`),

  getTypes: () => apiRequest<LeaveType[]>('/leaves/types'),

  create: (data: Record<string, unknown>) =>
    apiRequest<LeaveListItem>('/leaves', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<LeaveListItem>(`/leaves/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  approve: (id: string) =>
    apiRequest<LeaveListItem>(`/leaves/${id}/approve`, { method: 'PATCH' }),

  refuse: (id: string) =>
    apiRequest<LeaveListItem>(`/leaves/${id}/refuse`, { method: 'PATCH' }),

  delete: (id: string) => apiRequest(`/leaves/${id}`, { method: 'DELETE' }),
};

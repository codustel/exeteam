import { apiRequest } from './client';

export interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  managerId: string | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  contractType: string;
  hireDate: string;
  isActive: boolean;
  weeklyHours: number;
  _count: { tasks: number; timeEntries: number; leaveRequests: number };
}

export interface EmployeeListResponse {
  data: EmployeeListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface EmployeeStats {
  total: number;
  active: number;
  onLeave: number;
  avgOccupation: number;
}

export const employeesApi = {
  list: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<EmployeeListResponse>(`/employees?${qs}`);
  },

  getOne: (id: string) => apiRequest<EmployeeListItem>(`/employees/${id}`),

  getStats: () => apiRequest<EmployeeStats>('/employees/stats'),

  getOrgChart: () => apiRequest<any[]>('/employees/org-chart'),

  create: (data: Record<string, unknown>) =>
    apiRequest<EmployeeListItem>('/employees', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<EmployeeListItem>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/employees/${id}`, { method: 'DELETE' }),
};

import { apiRequest } from './client';

export interface ProjectListItem {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  clientId: string;
  client: { id: string; name: string; logoUrl: string | null };
  operator: { id: string; name: string } | null;
  responsible: { id: string; firstName: string; lastName: string } | null;
  status: string;
  priority: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  budgetHours: string | null;
  isActive: boolean;
  advancement: number;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  _count: { tasks: number };
  createdAt: string;
}

export interface ProjectDetail extends ProjectListItem {
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null;
  customFieldsConfig: Record<string, unknown> | null;
  tasks: TaskSummary[];
  _count: { tasks: number; demands: number; attachments: number };
}

export interface TaskSummary {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  facturable: boolean;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  employee: { id: string; firstName: string; lastName: string } | null;
  codeProduit: { id: string; code: string; designation: string } | null;
  _count: { timeEntries: number; comments: number };
}

export interface ProjectListResponse {
  data: ProjectListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ProjectStats {
  active: number;
  inProgress: number;
  avgAdvancement: number;
  overdue: number;
}

type ProjectParams = {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: string;
  operatorId?: string;
  responsibleId?: string;
  status?: string;
  priority?: string;
  isActive?: boolean;
};

export const projectsApi = {
  list: (params: ProjectParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<ProjectListResponse>(`/projects?${qs}`);
  },

  getOne: (id: string) => apiRequest<ProjectDetail>(`/projects/${id}`),

  getStats: () => apiRequest<ProjectStats>('/projects/stats'),

  create: (data: Record<string, unknown>) =>
    apiRequest<ProjectListItem>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<ProjectListItem>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/projects/${id}`, { method: 'DELETE' }),
};

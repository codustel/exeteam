import { apiRequest } from './client';

export interface TaskListItem {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  projectId: string;
  project: { id: string; reference: string; title: string };
  site: { id: string; name: string } | null;
  employee: { id: string; firstName: string; lastName: string } | null;
  codeProduit: { id: string; code: string; designation: string; timeGamme: string | null } | null;
  status: string;
  priority: string;
  facturable: boolean;
  dateReception: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  estimatedHours: string | null;
  budgetHours: string | null;
  deliverableLinks: string[];
  customFieldsData: Record<string, unknown> | null;
  delaiRL: number | null;
  rendement: number | null;
  totalHours: number;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  _count: { comments: number; deliverables: number };
  createdAt: string;
  updatedAt: string;
}

export interface TaskDeliverable {
  id: string;
  taskId: string;
  url: string;
  type: string | null;
  label: string | null;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  author: { id: string; email: string };
  content: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryItem {
  id: string;
  taskId: string;
  userId: string;
  user: { id: string; email: string };
  previousStatus: string;
  newStatus: string;
  changedAt: string;
  comment: string | null;
}

export interface TimeEntryItem {
  id: string;
  taskId: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string };
  userId: string;
  date: string;
  hours: string;
  comment: string | null;
  isValidated: boolean;
  createdAt: string;
}

export interface TaskDetail extends TaskListItem {
  demand: { id: string; quantity: number } | null;
  timeEntries: TimeEntryItem[];
  comments: TaskComment[];
  statusHistory: StatusHistoryItem[];
  deliverables: TaskDeliverable[];
}

export interface TaskListResponse {
  data: TaskListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface TaskStats {
  total: number;
  inProgress: number;
  doneThisMonth: number;
  avgRendement: number;
}

type TaskParams = {
  page?: number;
  limit?: number;
  search?: string;
  projectId?: string;
  siteId?: string;
  employeeId?: string;
  codeProduitId?: string;
  status?: string;
  facturable?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

export const tasksApi = {
  list: (params: TaskParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<TaskListResponse>(`/tasks?${qs}`);
  },

  getOne: (id: string) => apiRequest<TaskDetail>(`/tasks/${id}`),

  getStats: () => apiRequest<TaskStats>('/tasks/stats'),

  create: (data: Record<string, unknown>) =>
    apiRequest<TaskListItem>('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<TaskDetail>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/tasks/${id}`, { method: 'DELETE' }),

  addDeliverable: (taskId: string, data: { url: string; type?: string; label?: string }) =>
    apiRequest<TaskDeliverable>(`/tasks/${taskId}/deliverables`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeDeliverable: (taskId: string, deliverableId: string) =>
    apiRequest(`/tasks/${taskId}/deliverables/${deliverableId}`, { method: 'DELETE' }),

  addComment: (taskId: string, data: { content: string; attachments?: string[] }) =>
    apiRequest<TaskComment>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteComment: (taskId: string, commentId: string) =>
    apiRequest(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),
};

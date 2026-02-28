import { apiRequest } from './client';

export interface SiteListItem {
  id: string;
  reference: string;
  name: string;
  address: string | null;
  commune: string | null;
  departement: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  client: { id: string; name: string; logoUrl: string | null };
  operator: { id: string; name: string } | null;
  typologie: { id: string; name: string; slug: string } | null;
  _count: { tasks: number };
}

export interface SiteListResponse {
  data: SiteListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SiteStats {
  total: number;
  active: number;
  inactive: number;
  withActiveTasks: number;
}

export const sitesApi = {
  list: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<SiteListResponse>(`/sites?${qs}`);
  },

  getOne: (id: string) => apiRequest<SiteListItem & { tasks: unknown[]; customFieldsData: unknown }>(`/sites/${id}`),

  getStats: () => apiRequest<SiteStats>('/sites/stats'),

  getTypologies: () => apiRequest<Array<{ id: string; name: string; slug: string; order: number }>>('/sites/typologies'),

  create: (data: Record<string, unknown>) =>
    apiRequest<SiteListItem>('/sites', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<SiteListItem>(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/sites/${id}`, { method: 'DELETE' }),
};

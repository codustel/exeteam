import { apiRequest } from './client';

export interface ClientListItem {
  id: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  city: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  siret: string | null;
  country: string | null;
  isActive: boolean;
  operators: Array<{ operator: { id: string; name: string; logoUrl: string | null } }>;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  _count: { sites: number; projects: number; interlocuteurs: number };
}

export interface ClientListResponse {
  data: ClientListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ClientStats {
  total: number;
  active: number;
  inactive: number;
  withProjects: number;
}

export const clientsApi = {
  list: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<ClientListResponse>(`/clients?${qs}`);
  },

  getOne: (id: string) => apiRequest<ClientListItem & { interlocuteurs: unknown[]; codesProduits: unknown[] }>(`/clients/${id}`),

  getStats: () => apiRequest<ClientStats>('/clients/stats'),

  create: (data: Record<string, unknown>) =>
    apiRequest<ClientListItem>('/clients', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<ClientListItem>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/clients/${id}`, { method: 'DELETE' }),

  updateLogoUrl: (id: string, logoUrl: string) =>
    apiRequest(`/clients/${id}/logo-url`, { method: 'PATCH', body: JSON.stringify({ logoUrl }) }),
};

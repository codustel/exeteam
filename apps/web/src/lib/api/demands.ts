import { apiRequest } from './client';

export type DemandStatus = 'nouvelle' | 'en_cours' | 'terminee' | 'annulee';
export type DemandPriority = 'basse' | 'normale' | 'haute' | 'urgente';

export interface DemandListItem {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  dataLink: string | null;
  status: DemandStatus;
  priority: DemandPriority;
  requestedAt: string;
  desiredDelivery: string | null;
  createdAt: string;
  client: { id: string; name: string };
  project: { id: string; name: string; reference: string };
  site: { id: string; name: string } | null;
  demandeur: { id: string; firstName: string; lastName: string; email: string } | null;
  employee: { id: string; firstName: string; lastName: string } | null;
  codeProduit: { id: string; code: string; label: string } | null;
  task: { id: string; reference: string; title: string; status: string } | null;
}

export interface DemandDetail extends DemandListItem {
  site: { id: string; name: string; address: string | null } | null;
  demandeur: { id: string; firstName: string; lastName: string; email: string; phone: string | null } | null;
  createdBy: { id: string; email: string };
  task: {
    id: string;
    reference: string;
    title: string;
    status: string;
    priority: string;
    plannedEndDate: string | null;
    employee: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

export interface DemandListResponse {
  data: DemandListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DemandStats {
  nouvelles: number;
  enCours: number;
  termineesThisMonth: number;
  aConvertir: number;
}

export interface CreateDemandPayload {
  projectId: string;
  clientId: string;
  codeProduitId?: string;
  siteId?: string;
  demandeurId?: string;
  employeeId?: string;
  title: string;
  description?: string;
  dataLink?: string;
  status?: DemandStatus;
  priority?: DemandPriority;
  requestedAt?: string;
  desiredDelivery?: string;
}

export type UpdateDemandPayload = Partial<CreateDemandPayload>;

export const demandsApi = {
  list: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<DemandListResponse>(`/demands?${qs}`);
  },

  getOne: (id: string) => apiRequest<DemandDetail>(`/demands/${id}`),

  getStats: () => apiRequest<DemandStats>('/demands/stats'),

  create: (data: CreateDemandPayload) =>
    apiRequest<DemandListItem>('/demands', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateDemandPayload) =>
    apiRequest<DemandListItem>(`/demands/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest(`/demands/${id}`, { method: 'DELETE' }),

  convertToTask: (id: string) =>
    apiRequest<{ id: string; reference: string; title: string }>(`/demands/${id}/convert-to-task`, {
      method: 'POST',
    }),
};

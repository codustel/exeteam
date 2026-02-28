import { apiRequest } from './client';

export interface ClientListItem {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface ClientListResponse {
  data: ClientListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const clientsApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<ClientListResponse>(`/clients?${qs}`);
  },
};

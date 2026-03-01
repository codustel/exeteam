import { apiRequest } from './client';

export interface ProductListItem {
  id: string;
  code: string;
  designation: string;
  productType: string;
  unitType: string;
  unitPrice: number;
  timeGamme: number | null;
  clientId: string | null;
  client: { id: string; name: string } | null;
  currencyId: string | null;
  isActive: boolean;
}

export interface ProductListResponse {
  data: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ProductStats {
  total: number;
  byType: Record<string, number>;
}

export const productsApi = {
  list: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<ProductListResponse>(`/codes-produits?${qs}`);
  },

  getOne: (id: string) => apiRequest<ProductListItem>(`/codes-produits/${id}`),

  getStats: () => apiRequest<ProductStats>('/codes-produits/stats'),

  create: (data: Record<string, unknown>) =>
    apiRequest<ProductListItem>('/codes-produits', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiRequest<ProductListItem>(`/codes-produits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/codes-produits/${id}`, { method: 'DELETE' }),
};

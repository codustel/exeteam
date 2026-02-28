import { apiRequest } from './client';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsListResponse {
  data: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationsApi = {
  list: (params: { page?: number; limit?: number; isRead?: boolean } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<NotificationsListResponse>(`/notifications?${qs}`);
  },

  getUnreadCount: () => apiRequest<UnreadCountResponse>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiRequest<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiRequest<{ success: boolean }>('/notifications/read-all', { method: 'PATCH' }),
};

import { apiRequest } from './client';

export interface ConversationListItem {
  id: string;
  name: string | null;
  isGroup: boolean;
  updatedAt: string;
  members: Array<{
    employeeId: string;
    employee: { id: string; firstName: string; lastName: string; userId: string };
  }>;
  messages: Array<{
    id: string;
    content: string;
    createdAt: string;
    sender: { id: string; email: string };
  }>;
  _count: { messages: number };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  fileUrl: string | null;
  isRead: boolean;
  createdAt: string;
  sender: { id: string; email: string };
}

export const messagingApi = {
  listConversations: () => apiRequest<ConversationListItem[]>('/conversations'),
  getConversation: (id: string) => apiRequest<any>(`/conversations/${id}`),
  createConversation: (data: { name?: string; isGroup: boolean; memberEmployeeIds: string[] }) =>
    apiRequest<any>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
  getMessages: (id: string, before?: string) =>
    apiRequest<Message[]>(`/conversations/${id}/messages${before ? `?before=${before}` : ''}`),
  sendMessage: (id: string, data: { content: string; fileUrl?: string }) =>
    apiRequest<Message>(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  markRead: (id: string) =>
    apiRequest(`/conversations/${id}/read`, { method: 'POST', body: '{}' }),
  addMember: (id: string, employeeId: string) =>
    apiRequest(`/conversations/${id}/members`, { method: 'POST', body: JSON.stringify({ employeeId }) }),
  findOrCreateDirect: (employeeId: string) =>
    apiRequest<any>(`/conversations/direct/${employeeId}`, { method: 'POST', body: '{}' }),
};

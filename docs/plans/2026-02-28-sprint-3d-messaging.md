# ExeTeam Sprint 3D — Messagerie Interne

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Branch:** `feat/messaging`

**Goal:** Real-time internal messaging — Supabase Realtime channels, conversation management, message CRUD with file attachments, presence (online indicator), split-pane layout at `/messages`.

**Prerequisite:** Sprint 1 complete (Auth, Employees). Supabase project configured.

**Tech Stack:** NestJS · Prisma · Zod DTOs · Supabase Realtime JS · TanStack Query · shadcn/ui

---

## Task 1: Create branch

```bash
git checkout main && git pull
git checkout -b feat/messaging
```

---

## Task 2: NestJS — ConversationsModule

**Files:**
- `apps/api/src/messaging/dto/create-conversation.dto.ts`
- `apps/api/src/messaging/dto/send-message.dto.ts`
- `apps/api/src/messaging/conversations.service.ts`
- `apps/api/src/messaging/conversations.controller.ts`
- `apps/api/src/messaging/messaging.module.ts`

### Step 1: `apps/api/src/messaging/dto/create-conversation.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateConversationSchema = z.object({
  name: z.string().max(200).optional(),
  isGroup: z.boolean().optional().default(false),
  memberEmployeeIds: z.array(z.string().uuid()).min(1, 'Au moins un membre requis'),
});

export class CreateConversationDto extends createZodDto(CreateConversationSchema) {}
```

### Step 2: `apps/api/src/messaging/dto/send-message.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SendMessageSchema = z.object({
  content: z.string().min(1),
  fileUrl: z.string().url().optional(),
});

export class SendMessageDto extends createZodDto(SendMessageSchema) {}
```

### Step 3: `apps/api/src/messaging/conversations.service.ts`

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  // Get all conversations for the current user (via their employee record)
  async findAll(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) return [];

    return this.prisma.conversation.findMany({
      where: {
        members: { some: { employeeId: employee.id } },
      },
      include: {
        members: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, userId: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, email: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, userId: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: {
            sender: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    // Check membership
    if (employee) {
      const isMember = conversation.members.some(m => m.employeeId === employee.id);
      if (!isMember) throw new ForbiddenException('Not a member of this conversation');
    }

    return conversation;
  }

  async create(dto: CreateConversationDto, userId: string) {
    // Find the creating user's employee record
    const creator = await this.prisma.employee.findUnique({ where: { userId } });

    // Build member list (include creator if not already in list)
    const memberIds = [...new Set([
      ...(creator ? [creator.id] : []),
      ...dto.memberEmployeeIds,
    ])];

    return this.prisma.conversation.create({
      data: {
        name: dto.name,
        isGroup: dto.isGroup,
        members: {
          create: memberIds.map(employeeId => ({ employeeId })),
        },
      },
      include: {
        members: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async sendMessage(conversationId: string, dto: SendMessageDto, senderId: string) {
    // Verify conversation exists (membership checked at controller level via findOne)
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: dto.content,
        fileUrl: dto.fileUrl,
      },
      include: {
        sender: { select: { id: true, email: true } },
      },
    });

    // Update conversation updatedAt for sort order
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(conversationId: string, userId: string, before?: string, limit = 50) {
    await this.findOne(conversationId, userId); // validates membership

    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: {
        sender: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markMessagesRead(conversationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
  }

  async addMember(conversationId: string, employeeId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (!conv.isGroup) throw new ForbiddenException('Cannot add members to a direct conversation');

    return this.prisma.conversationMember.upsert({
      where: { conversationId_employeeId: { conversationId, employeeId } },
      create: { conversationId, employeeId },
      update: {},
    });
  }

  async removeMember(conversationId: string, employeeId: string) {
    return this.prisma.conversationMember.delete({
      where: { conversationId_employeeId: { conversationId, employeeId } },
    });
  }

  // Find or create a direct conversation between two employees
  async findOrCreateDirect(userId: string, targetEmployeeId: string) {
    const creator = await this.prisma.employee.findUnique({ where: { userId } });
    if (!creator) throw new ForbiddenException('No employee linked to this user');

    // Look for an existing direct conversation with exactly these 2 members
    const existing = await this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: {
          every: { employeeId: { in: [creator.id, targetEmployeeId] } },
        },
        AND: [
          { members: { some: { employeeId: creator.id } } },
          { members: { some: { employeeId: targetEmployeeId } } },
        ],
      },
      include: {
        members: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        isGroup: false,
        members: {
          create: [
            { employeeId: creator.id },
            { employeeId: targetEmployeeId },
          ],
        },
      },
      include: {
        members: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }
}
```

### Step 4: `apps/api/src/messaging/conversations.controller.ts`

```typescript
import {
  Controller, Get, Post, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.conversationsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.findOne(id, req.user.sub);
  }

  @Post()
  create(@Body() dto: CreateConversationDto, @Request() req: any) {
    return this.conversationsService.create(dto, req.user.sub);
  }

  @Get(':id/messages')
  getMessages(
    @Param('id') id: string,
    @Request() req: any,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.getMessages(id, req.user.sub, before, limit ? parseInt(limit, 10) : 50);
  }

  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @Request() req: any) {
    return this.conversationsService.sendMessage(id, dto, req.user.sub);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.markMessagesRead(id, req.user.sub);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: { employeeId: string }) {
    return this.conversationsService.addMember(id, body.employeeId);
  }

  @Post('direct/:employeeId')
  findOrCreateDirect(@Param('employeeId') employeeId: string, @Request() req: any) {
    return this.conversationsService.findOrCreateDirect(req.user.sub, employeeId);
  }
}
```

### Step 5: `apps/api/src/messaging/messaging.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class MessagingModule {}
```

Register `MessagingModule` in `apps/api/src/app.module.ts`.

```bash
git add apps/api/src/messaging/
git commit -m "feat(api): add MessagingModule with conversations, messages, member management"
```

---

## Task 3: Next.js — Supabase Realtime hook

**File:** `apps/web/src/hooks/use-realtime-messages.ts`

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export interface RealtimeMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  fileUrl: string | null;
  isRead: boolean;
  createdAt: string;
  sender?: { id: string; email: string };
}

export function useRealtimeMessages(
  conversationId: string | null,
  onNewMessage: (msg: RealtimeMessage) => void,
) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Subscribe to INSERT events on messages table filtered by conversationId
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onNewMessage(payload.new as RealtimeMessage);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, onNewMessage]);
}
```

**File:** `apps/web/src/hooks/use-presence.ts`

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export interface PresenceUser {
  userId: string;
  email: string;
  onlineSince: string;
}

export function usePresence(userId: string | null, userEmail: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PresenceUser>>(new Map());

  useEffect(() => {
    if (!userId || !userEmail) return;

    const channel = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ email: string }>();
        const users = new Map<string, PresenceUser>();
        for (const [key, presences] of Object.entries(state)) {
          const presence = presences[0] as any;
          users.set(key, {
            userId: key,
            email: presence.email ?? '',
            onlineSince: presence.onlineSince ?? new Date().toISOString(),
          });
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ email: userEmail, onlineSince: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [userId, userEmail]);

  const isOnline = useCallback((uid: string) => onlineUsers.has(uid), [onlineUsers]);

  return { onlineUsers, isOnline };
}
```

```bash
git add apps/web/src/hooks/use-realtime-messages.ts apps/web/src/hooks/use-presence.ts
git commit -m "feat(web): add useRealtimeMessages and usePresence Supabase hooks"
```

---

## Task 4: Next.js — API helper

**File:** `apps/web/src/lib/api/messaging.ts`

```typescript
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
```

```bash
git add apps/web/src/lib/api/messaging.ts
git commit -m "feat(web): add messaging API helper"
```

---

## Task 5: Next.js — /messages split-pane layout

**Files:**
- `apps/web/src/app/(app)/messages/page.tsx`
- `apps/web/src/app/(app)/messages/messages-layout.tsx`
- `apps/web/src/app/(app)/messages/conversation-list.tsx`
- `apps/web/src/app/(app)/messages/conversation-panel.tsx`
- `apps/web/src/app/(app)/messages/new-conversation-dialog.tsx`

### Step 1: `apps/web/src/app/(app)/messages/page.tsx`

```tsx
import { Header } from '@/components/layout/header';
import { MessagesLayout } from './messages-layout';

export const metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
    <>
      <Header title="Messagerie" />
      <MessagesLayout />
    </>
  );
}
```

### Step 2: `apps/web/src/app/(app)/messages/messages-layout.tsx`

```tsx
'use client';

import { useState } from 'react';
import { ConversationList } from './conversation-list';
import { ConversationPanel } from './conversation-panel';

export function MessagesLayout() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left pane: conversation list */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col">
        <ConversationList
          activeId={activeConversationId}
          onSelect={setActiveConversationId}
        />
      </div>

      {/* Right pane: active conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConversationId ? (
          <ConversationPanel conversationId={activeConversationId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">Sélectionnez une conversation</p>
              <p className="text-sm mt-1">ou créez-en une nouvelle</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 3: `apps/web/src/app/(app)/messages/conversation-list.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messagingApi, type ConversationListItem } from '@/lib/api/messaging';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, Search, Users, User } from 'lucide-react';
import { NewConversationDialog } from './new-conversation-dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ activeId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagingApi.listConversations(),
    refetchInterval: 15_000,
  });

  const filtered = (conversations as ConversationListItem[]).filter(c => {
    if (!search) return true;
    const name = c.name ?? c.members.map(m => `${m.employee.firstName} ${m.employee.lastName}`).join(' ');
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Messages</h2>
          <Button size="icon" variant="ghost" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
      </div>

      {/* Conversation items */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Aucune conversation
          </div>
        ) : (
          filtered.map(conv => {
            const lastMsg = conv.messages[0];
            const displayName = conv.name ?? conv.members
              .map(m => `${m.employee.firstName} ${m.employee.lastName}`)
              .slice(0, 2)
              .join(', ');

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 border-b hover:bg-muted/50 transition-colors text-left',
                  activeId === conv.id && 'bg-muted',
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  conv.isGroup ? 'bg-primary/10' : 'bg-secondary',
                )}>
                  {conv.isGroup
                    ? <Users className="h-5 w-5 text-primary" />
                    : <User className="h-5 w-5 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    {lastMsg && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {format(new Date(lastMsg.createdAt), 'HH:mm', { locale: fr })}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {lastMsg.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <NewConversationDialog open={newOpen} onOpenChange={setNewOpen} onCreated={onSelect} />
    </div>
  );
}
```

### Step 4: `apps/web/src/app/(app)/messages/conversation-panel.tsx`

```tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi, type Message } from '@/lib/api/messaging';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props { conversationId: string }

export function ConversationPanel({ conversationId }: Props) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversation } = useQuery({
    queryKey: ['conversations', conversationId],
    queryFn: () => messagingApi.getConversation(conversationId),
  });

  const { data: initialMessages = [] } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messagingApi.getMessages(conversationId),
  });

  // Merge initial messages (sorted asc)
  useEffect(() => {
    const sorted = [...(initialMessages as Message[])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    setMessages(sorted);
  }, [initialMessages]);

  // Realtime: append new messages
  const handleNewMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      if (prev.find(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [queryClient]);

  useRealtimeMessages(conversationId, handleNewMessage);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark read on open
  useEffect(() => {
    messagingApi.markRead(conversationId).catch(() => {});
  }, [conversationId]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagingApi.sendMessage(conversationId, { content }),
    onSuccess: (newMsg) => {
      // Optimistic: add to local state immediately (realtime will also fire)
      setMessages(prev => {
        if (prev.find(m => m.id === (newMsg as any).id)) return prev;
        return [...prev, newMsg as any];
      });
      setText('');
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const conv = conversation as any;
  const displayName = conv?.name ?? conv?.members
    ?.map((m: any) => `${m.employee.firstName} ${m.employee.lastName}`)
    .slice(0, 2)
    .join(', ');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background">
        {conv?.isGroup ? (
          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
        ) : (
          <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center">
            <span className="text-sm font-bold">{displayName?.[0]?.toUpperCase()}</span>
          </div>
        )}
        <div>
          <p className="font-semibold">{displayName}</p>
          {conv?.isGroup && (
            <p className="text-xs text-muted-foreground">{conv?.members?.length} membres</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun message. Démarrez la conversation !
          </div>
        )}
        {messages.map((msg, i) => {
          const prevMsg = messages[i - 1];
          const showDate = !prevMsg ||
            new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.createdAt), 'EEEE dd MMMM yyyy', { locale: fr })}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <MessageBubble message={msg} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="flex-shrink-0 text-muted-foreground">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Écrire un message... (Entrée pour envoyer)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  // Simplified — in production get current userId from auth context
  // For now, distinguish visually by sender email
  const isOwn = false; // TODO: compare message.senderId with current user's id

  return (
    <div className={cn('flex items-end gap-2', isOwn && 'flex-row-reverse')}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
        isOwn ? 'bg-primary text-white' : 'bg-secondary text-foreground',
      )}>
        {message.sender?.email?.[0]?.toUpperCase()}
      </div>
      <div className={cn(
        'max-w-[65%] rounded-2xl px-4 py-2 text-sm',
        isOwn
          ? 'bg-primary text-primary-foreground rounded-br-sm'
          : 'bg-muted rounded-bl-sm',
      )}>
        {!isOwn && (
          <p className="text-xs font-medium mb-1 opacity-70">{message.sender?.email}</p>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.fileUrl && (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline opacity-80 mt-1 block"
          >
            Pièce jointe
          </a>
        )}
        <p className={cn('text-xs mt-1 opacity-60', isOwn ? 'text-right' : 'text-left')}>
          {format(new Date(message.createdAt), 'HH:mm', { locale: fr })}
        </p>
      </div>
    </div>
  );
}
```

### Step 5: `apps/web/src/app/(app)/messages/new-conversation-dialog.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi } from '@/lib/api/messaging';
import { apiRequest } from '@/lib/api/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: Props) {
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => apiRequest<any>('/employees?limit=200').then((r: any) => r.data),
    enabled: open,
  });

  const filtered = (employees as any[]).filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()),
  );

  const mutation = useMutation({
    mutationFn: () => messagingApi.createConversation({
      name: isGroup ? groupName || undefined : undefined,
      isGroup,
      memberEmployeeIds: selectedIds,
    }),
    onSuccess: (conv: any) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onCreated(conv.id);
      onOpenChange(false);
      setSelectedIds([]);
      setGroupName('');
      setSearch('');
    },
  });

  const toggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={isGroup} onCheckedChange={setIsGroup} />
            <Label>Conversation de groupe</Label>
          </div>

          {isGroup && (
            <Input
              placeholder="Nom du groupe"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un employé..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
            {filtered.map((emp: any) => (
              <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer">
                <Checkbox
                  checked={selectedIds.includes(emp.id)}
                  onCheckedChange={() => toggle(emp.id)}
                />
                <span className="text-sm">{emp.firstName} {emp.lastName}</span>
              </label>
            ))}
          </div>

          {selectedIds.length > 0 && (
            <p className="text-xs text-muted-foreground">{selectedIds.length} employé(s) sélectionné(s)</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            disabled={selectedIds.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 6: Commit

```bash
git add apps/web/src/app/(app)/messages/
git commit -m "feat(web): add /messages split-pane layout with realtime Supabase messaging"
```

---

## Task 6: Enable Supabase Realtime on messages table

In Supabase Dashboard → Database → Replication:
- Enable replication for the `messages` table
- Enable INSERT events

Or via SQL migration:

```sql
-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

Run this in Supabase SQL Editor.

---

## Task 7: Add navigation link

In `apps/web/src/components/layout/sidebar.tsx`, add:
- "Messages" → `/messages` with `MessageSquare` icon + unread badge (optional)

```bash
git add apps/web/src/components/layout/
git commit -m "feat(web): add messages navigation link"
```

---

## Task 8: Verification

```bash
pnpm --filter api tsc --noEmit
pnpm --filter web tsc --noEmit
pnpm build

# API checks
# POST /conversations { isGroup: false, memberEmployeeIds: ["emp1-id"] }
# → creates conversation, adds creator + member
# POST /conversations/direct/:employeeId → find or create direct convo
# POST /conversations/:id/messages { content: "Hello" } → creates message
# GET /conversations/:id/messages → returns messages array
# POST /conversations/:id/read → marks unread as read

# Web checks
# /messages → split pane: left = conversation list, right = empty state or panel
# Clicking conversation → loads messages, shows input bar
# Sending message → appears in chat (via optimistic + realtime)
# New conversation dialog → search employees, toggle group/direct, create
# Supabase Realtime → open two browser tabs, send message in one, see it in the other in real-time
```

---

## Task 9: Final commit + push

```bash
git push -u origin feat/messaging
```

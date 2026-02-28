'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messagingApi, type ConversationListItem } from '@/lib/api/messaging';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

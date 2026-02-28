'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi, type Message } from '@/lib/api/messaging';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

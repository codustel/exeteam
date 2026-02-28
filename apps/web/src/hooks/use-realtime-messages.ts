'use client';

import { useEffect, useRef } from 'react';
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

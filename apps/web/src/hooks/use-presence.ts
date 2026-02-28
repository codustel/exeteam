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

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

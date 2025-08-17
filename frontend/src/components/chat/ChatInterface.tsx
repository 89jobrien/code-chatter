'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { useChatState, useChatActions } from '@/contexts/ChatContext';
import { useConnectivity, useDatabaseStatus } from '@/contexts/AppContext';
import { Trash2, WifiOff, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  className?: string;
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const { messages, isReady } = useChatState();
  const { clearMessages } = useChatActions();
  const { isConnected } = useConnectivity();
  const { databaseStatus } = useDatabaseStatus();

  const canChat = isConnected && isReady &&
    (databaseStatus?.status === 'healthy' || databaseStatus?.status === 'available');

  const handleClearMessages = () => {
    if (window.confirm('Are you sure you want to clear all messages?')) {
      clearMessages();
    }
  };

  // Connection status indicator
  const renderStatusIndicator = () => {
    if (!isConnected) {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <WifiOff className="h-4 w-4" />
          <span>Disconnected from server</span>
        </div>
      );
    }

    if (!databaseStatus) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4 animate-pulse" />
          <span>Checking database status...</span>
        </div>
      );
    }

    if (databaseStatus.status === 'not_available') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>No documents processed yet</span>
        </div>
      );
    }

    if (databaseStatus.status === 'error') {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Database className="h-4 w-4" />
          <span>Database error</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Database className="h-4 w-4 text-green-500" />
        <span>
          Ready • {databaseStatus.document_count} documents
        </span>
      </div>
    );
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Chat with your code</CardTitle>
            {renderStatusIndicator()}
          </div>

          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearMessages}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 p-0">
        <ChatMessages className="flex-1" />

        <div className="p-6 pt-0">
          <ChatInput disabled={!canChat} />

          {!canChat && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {!isConnected
                ? 'Please check your connection to the server.'
                : !isReady || databaseStatus?.status === 'not_available'
                  ? 'Please process some files or a repository first.'
                  : 'Chat is currently unavailable.'
              }
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

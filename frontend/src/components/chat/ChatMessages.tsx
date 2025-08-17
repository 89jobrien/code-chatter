'use client';

import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { useMessages } from '@/contexts/ChatContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ChatMessagesProps {
  className?: string;
  autoScroll?: boolean;
}

export function ChatMessages({ className, autoScroll = true }: ChatMessagesProps) {
  const messages = useMessages();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages, autoScroll]);

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = '';
    let currentGroup: typeof messages = [];

    messages.forEach((message) => {
      const messageDate = message.timestamp.toDateString();
      
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = messageDate;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  };

  const messageGroups = groupMessagesByDate();

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  if (messages.length === 0) {
    return (
      <div className={cn(
        'flex-1 flex items-center justify-center text-center p-8',
        className
      )}>
        <div className="max-w-md space-y-4">
          <div className="text-4xl">💬</div>
          <div>
            <h3 className="text-lg font-semibold text-muted-foreground">
              Ready to chat!
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              Start by asking a question about your codebase or choose from the suggested questions below.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea 
      className={cn('flex-1 px-4', className)}
      ref={scrollAreaRef}
    >
      <div className="space-y-6 py-4">
        {messageGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-4">
            {/* Date header */}
            <div className="flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
                {formatDateHeader(group.date)}
              </span>
              <Separator className="flex-1" />
            </div>

            {/* Messages for this date */}
            <div className="space-y-4">
              {group.messages.map((message, messageIndex) => {
                const prevMessage = messageIndex > 0 ? group.messages[messageIndex - 1] : null;
                const showAvatar = !prevMessage || prevMessage.sender !== message.sender;

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    showAvatar={showAvatar}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div ref={messagesEndRef} />
    </ScrollArea>
  );
}

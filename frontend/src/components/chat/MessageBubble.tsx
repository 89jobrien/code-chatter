'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Message } from '@/types';
import { Bot, User, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  className?: string;
}

export function MessageBubble({ message, showAvatar = true, className }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const isBot = message.sender === 'bot';
  const isUser = message.sender === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const detectCodeBlocks = (content: string) => {
    // Simple code block detection
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2],
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  const renderContent = () => {
    const parts = detectCodeBlocks(message.content);

    return parts.map((part, index) => {
      if (part.type === 'code') {
        return (
          <div key={index} className="my-2">
            <SyntaxHighlighter
              language={part.language}
              style={vscDarkPlus}
              customStyle={{
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
              PreTag="div"
            >
              {part.content}
            </SyntaxHighlighter>
          </div>
        );
      }

      return (
        <p key={index} className="whitespace-pre-wrap break-words">
          {part.content}
        </p>
      );
    });
  };

  return (
    <div
      className={cn(
        'flex gap-3 group',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {isBot && showAvatar && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className="bg-primary/10">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className="flex flex-col gap-1 max-w-[80%] lg:max-w-[60%]">
        <div
          className={cn(
            'rounded-lg px-3 py-2',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted border',
            message.isStreaming && 'animate-pulse'
          )}
        >
          <div className="relative">
            {renderContent()}
            
            {/* Copy button */}
            {message.content && !message.isStreaming && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0",
                  isUser ? "text-primary-foreground/70 hover:text-primary-foreground" : ""
                )}
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Sources section */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowSources(!showSources)}
            >
              {showSources ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Hide sources ({message.sources.length})
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show sources ({message.sources.length})
                </>
              )}
            </Button>

            {showSources && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source, index) => (
                  <Card key={index} className="p-3">
                    <CardContent className="p-0">
                      <div className="text-xs text-muted-foreground mb-1">
                        Source {index + 1}
                        {source.metadata.source_file && (
                          <span className="ml-2 font-mono">
                            {source.metadata.source_file}
                          </span>
                        )}
                      </div>
                      <Separator className="my-2" />
                      <p className="text-sm">{source.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className={cn(
          "text-xs text-muted-foreground px-1",
          isUser ? "text-right" : "text-left"
        )}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>

      {isUser && showAvatar && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className="bg-primary/10">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

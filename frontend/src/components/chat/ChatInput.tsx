'use client';

import React, { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useChatInput, useChatState, useChatActions } from '@/contexts/ChatContext';
import { Send, Loader2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  disabled?: boolean;
  className?: string;
}

export function ChatInput({ disabled = false, className }: ChatInputProps) {
  // get raw context values (may be undefined if provider not present yet)
  const rawInput = useChatInput();
  const rawState = useChatState();
  const rawActions = useChatActions();

  // provide safe defaults
  const currentInput: string = rawInput?.currentInput ?? '';
  const setCurrentInput: (v: string) => void = rawInput?.setCurrentInput ?? (() => { });
  const isStreaming: boolean = rawState?.isStreaming ?? false;
  const isProcessing: boolean = rawState?.isProcessing ?? false;
  const suggestedQuestions: string[] = rawState?.suggestedQuestions ?? [];
  const sendMessageStreaming: (msg: string) => Promise<void> = rawActions?.sendMessageStreaming ?? (async () => { });

  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDisabled = disabled || isStreaming || isProcessing;
  const trimmedInput = (currentInput ?? '').trim();
  const canSend = trimmedInput.length > 0 && !isDisabled;

  const handleSubmit = async () => {
    if (!canSend) return;

    const message = trimmedInput;
    setCurrentInput('');
    setShowSuggestions(false);

    try {
      await sendMessageStreaming(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setCurrentInput(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const shouldShowSuggestions =
    showSuggestions &&
    (suggestedQuestions?.length ?? 0) > 0 &&
    trimmedInput.length === 0 &&
    !isStreaming &&
    !isProcessing;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Suggested Questions */}
      {shouldShowSuggestions && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span>Suggested questions:</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestedQuestions.slice(0, 4).map((suggestion, index) => (
              <Card
                key={index}
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border-dashed"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <p className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {suggestion}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex gap-2"
      >
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'AI is responding...'
                : isProcessing
                  ? 'Processing your message...'
                  : 'Ask a question about the code...'
            }
            disabled={isDisabled}
            className="pr-12"
          />

          {/* Character count indicator for long messages */}
          {(currentInput ?? '').length > 800 && (
            <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground">
              {(currentInput ?? '').length}/1000
            </div>
          )}
        </div>

        <Button type="submit" disabled={!canSend} size="icon" className="shrink-0">
          {isStreaming || isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
          </div>
          <span>AI is thinking...</span>
        </div>
      )}
    </div>
  );
}
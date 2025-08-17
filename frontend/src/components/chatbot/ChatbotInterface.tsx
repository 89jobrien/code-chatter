'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  Trash2, 
  RefreshCw,
  MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { MarkdownContent } from '@/components/ui/markdown-content';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatbotInterfaceProps {
  className?: string;
}

export function ChatbotInterface({ className }: ChatbotInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Check connectivity on mount
  useEffect(() => {
    checkConnectivity();
  }, []);

  const checkConnectivity = async () => {
    try {
      const connected = await apiService.checkConnectivity();
      setIsConnected(connected);
    } catch {
      setIsConnected(false);
    }
  };

  const addMessage = (role: 'user' | 'assistant', content: string): string => {
    const id = `msg-${Date.now()}-${Math.random()}`;
    const message: ChatMessage = {
      id,
      role,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
    return id;
  };

  const updateMessage = (id: string, content: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === id ? { ...msg, content } : msg
      )
    );
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isConnected) {
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Add user message
    addMessage('user', userMessage);

    // Add empty assistant message that we'll stream into
    const assistantMessageId = addMessage('assistant', '');

    try {
      let assistantContent = '';

      await apiService.askChatbotStreaming(
        { text: userMessage },
        (chunk) => {
          assistantContent += chunk;
          updateMessage(assistantMessageId, assistantContent);
        }
      );

      // If no content was received, show error message
      if (!assistantContent.trim()) {
        updateMessage(assistantMessageId, 'I apologize, but I encountered an issue processing your request. Please try again.');
      }

    } catch (error) {
      console.error('Chat error:', error);
      updateMessage(
        assistantMessageId, 
        'I apologize, but I encountered an error. Please try again or check your connection.'
      );
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    toast.success('Conversation cleared');
  };

  const retryLastMessage = () => {
    if (messages.length >= 2) {
      const lastUserMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.role === 'user');
      
      if (lastUserMessage) {
        setInputMessage(lastUserMessage.content);
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Card className="flex-1 flex flex-col h-full">
        {/* Header */}
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Avatar className="h-10 w-10 bg-primary/10 border-2 border-primary/20">
                  <AvatarFallback>
                    <Bot className="h-5 w-5 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                  isConnected ? "bg-green-500" : "bg-red-500"
                )} />
              </div>
              <div>
                <CardTitle className="text-lg">AI Assistant</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? "Ready to help" : "Connection issue"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {messages.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryLastMessage}
                    disabled={isLoading}
                    title="Retry last message"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearConversation}
                    disabled={isLoading}
                    title="Clear conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <Separator />

        {/* Messages */}
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full px-6 py-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="relative">
                  <MessageCircle className="h-16 w-16 text-muted-foreground/50" />
                  <div className="absolute -bottom-1 -right-1">
                    <Bot className="h-6 w-6 text-primary bg-background rounded-full border-2 border-background" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-muted-foreground">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Ask me anything! I'm a general-purpose AI assistant ready to help with questions, 
                    brainstorming, explanations, and more.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setInputMessage("Write a Python function to calculate fibonacci numbers")}
                  >
                    Python Fibonacci
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setInputMessage("Create a React component for a todo list")}
                  >
                    React Component
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setInputMessage("What can you help me with?")}
                  >
                    What can you help me with?
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div key={message.id} className="flex space-x-3">
                    <Avatar className={cn(
                      "h-8 w-8 shrink-0",
                      message.role === 'user' 
                        ? "bg-primary" 
                        : "bg-secondary border"
                    )}>
                      <AvatarFallback>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4 text-primary-foreground" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <div className={cn(
                        "max-w-none",
                        message.role === 'user' 
                          ? "text-foreground" 
                          : "text-muted-foreground"
                      )}>
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {message.content}
                          </p>
                        ) : (
                          <MarkdownContent>{message.content}</MarkdownContent>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex space-x-3">
                    <Avatar className="h-8 w-8 bg-secondary border">
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="text-sm font-medium">Assistant</p>
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      </div>
                      <div className="text-muted-foreground">
                        <p>Thinking...</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <Separator />

        {/* Input */}
        <div className="p-4">
          {!isConnected && (
            <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive text-center">
              ⚠️ Connection issue. Check your connection and try again.
            </div>
          )}
          
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                isConnected 
                  ? "Ask me anything..." 
                  : "Reconnecting..."
              }
              disabled={isLoading || !isConnected}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !isConnected}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

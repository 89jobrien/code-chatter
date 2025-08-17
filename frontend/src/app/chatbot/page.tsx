'use client';

import React from 'react';
import { ChatbotInterface } from '@/components/chatbot/ChatbotInterface';

export default function ChatbotPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 h-[calc(100vh-8rem)]">
        <div className="max-w-6xl mx-auto h-full">
          <ChatbotInterface className="h-full" />
        </div>
      </div>
    </main>
  );
}

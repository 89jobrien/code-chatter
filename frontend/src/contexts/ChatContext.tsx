'use client';

import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { Message, ChatState } from '@/types';
import { apiService } from '@/services/api';
import { v4 as uuidv4 } from 'uuid';

// Initial state
const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  isProcessing: false,
  currentInput: '',
  suggestedQuestions: [],
  isReady: false,
};

// Action types
type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; content: string; sources?: any[] } }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_CURRENT_INPUT'; payload: string }
  | { type: 'SET_SUGGESTED_QUESTIONS'; payload: string[] }
  | { type: 'SET_READY'; payload: boolean }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'REMOVE_LAST_MESSAGE' };

// Reducer
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? { 
                ...msg, 
                content: action.payload.content,
                sources: action.payload.sources || msg.sources,
                isStreaming: false
              }
            : msg
        ),
      };
    
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };
    
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    
    case 'SET_CURRENT_INPUT':
      return { ...state, currentInput: action.payload };
    
    case 'SET_SUGGESTED_QUESTIONS':
      return { ...state, suggestedQuestions: action.payload };
    
    case 'SET_READY':
      return { ...state, isReady: action.payload };
    
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    
    case 'REMOVE_LAST_MESSAGE':
      return { ...state, messages: state.messages.slice(0, -1) };
    
    default:
      return state;
  }
}

// Context type
interface ChatContextType {
  state: ChatState;
  actions: {
    sendMessage: (content: string) => Promise<void>;
    sendMessageStreaming: (content: string) => Promise<void>;
    setCurrentInput: (input: string) => void;
    addSystemMessage: (content: string) => void;
    clearMessages: () => void;
    loadSuggestedQuestions: () => Promise<void>;
    setReady: (ready: boolean) => void;
  };
}

// Context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider component
interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Actions
  const actions = {
    async sendMessage(content: string) {
      const userMessage: Message = {
        id: uuidv4(),
        sender: 'user',
        content,
        timestamp: new Date(),
      };

      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatch({ type: 'SET_CURRENT_INPUT', payload: '' });
      dispatch({ type: 'SET_PROCESSING', payload: true });

      try {
        const response = await apiService.askQuestionSync({ text: content });
        
        const botMessage: Message = {
          id: uuidv4(),
          sender: 'bot',
          content: response.answer,
          timestamp: new Date(),
          sources: response.sources,
        };

        dispatch({ type: 'ADD_MESSAGE', payload: botMessage });
      } catch (error) {
        const errorMessage: Message = {
          id: uuidv4(),
          sender: 'bot',
          content: `I apologize, but I encountered an error while processing your question: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        };

        dispatch({ type: 'ADD_MESSAGE', payload: errorMessage });
      } finally {
        dispatch({ type: 'SET_PROCESSING', payload: false });
      }
    },

    async sendMessageStreaming(content: string) {
      const userMessage: Message = {
        id: uuidv4(),
        sender: 'user',
        content,
        timestamp: new Date(),
      };

      const botMessageId = uuidv4();
      const botMessage: Message = {
        id: botMessageId,
        sender: 'bot',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatch({ type: 'ADD_MESSAGE', payload: botMessage });
      dispatch({ type: 'SET_CURRENT_INPUT', payload: '' });
      dispatch({ type: 'SET_STREAMING', payload: true });

      try {
        await apiService.askQuestionStreaming(
          { text: content },
          (chunk: string) => {
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: { id: botMessageId, content: state.messages.find(m => m.id === botMessageId)?.content + chunk || chunk },
            });
          }
        );
      } catch (error) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            id: botMessageId,
            content: `I apologize, but I encountered an error while processing your question: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        });
      } finally {
        dispatch({ type: 'SET_STREAMING', payload: false });
      }
    },

    setCurrentInput(input: string) {
      dispatch({ type: 'SET_CURRENT_INPUT', payload: input });
    },

    addSystemMessage(content: string) {
      const systemMessage: Message = {
        id: uuidv4(),
        sender: 'bot',
        content,
        timestamp: new Date(),
      };

      dispatch({ type: 'ADD_MESSAGE', payload: systemMessage });
    },

    clearMessages() {
      dispatch({ type: 'CLEAR_MESSAGES' });
    },

    async loadSuggestedQuestions() {
      try {
        const response = await apiService.getSuggestedQuestions();
        dispatch({ type: 'SET_SUGGESTED_QUESTIONS', payload: response.suggestions });
      } catch (error) {
        console.error('Failed to load suggested questions:', error);
        // Set default suggestions on error
        dispatch({
          type: 'SET_SUGGESTED_QUESTIONS',
          payload: [
            'What is this codebase about?',
            'How is the code organized?',
            'What are the main dependencies?',
            'How can I get started with this project?',
          ],
        });
      }
    },

    setReady(ready: boolean) {
      dispatch({ type: 'SET_READY', payload: ready });
      if (ready) {
        // Load suggested questions when chat becomes ready
        actions.loadSuggestedQuestions();
      }
    },
  };

  // Load suggested questions when component mounts
  useEffect(() => {
    if (state.isReady) {
      actions.loadSuggestedQuestions();
    }
  }, [state.isReady]);

  const contextValue: ChatContextType = {
    state,
    actions,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

// Hook to use the context
export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// Convenience hooks
export function useChatState() {
  const { state } = useChat();
  return state;
}

export function useChatActions() {
  const { actions } = useChat();
  return actions;
}

export function useMessages() {
  const { state } = useChat();
  return state.messages;
}

export function useChatInput() {
  const { state, actions } = useChat();
  return {
    currentInput: state.currentInput,
    setCurrentInput: actions.setCurrentInput,
  };
}

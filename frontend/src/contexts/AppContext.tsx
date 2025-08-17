'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, HealthResponse, DatabaseStatus, FileProcessingStats } from '@/types';
import { apiService } from '@/services/api';

// Initial state
const initialState: AppState = {
  isConnected: false,
  healthStatus: null,
  databaseStatus: null,
  processingStats: null,
  currentRepository: null,
  lastProcessedFiles: null,
};

// Action types
type AppAction =
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_HEALTH_STATUS'; payload: HealthResponse | null }
  | { type: 'SET_DATABASE_STATUS'; payload: DatabaseStatus | null }
  | { type: 'SET_PROCESSING_STATS'; payload: FileProcessingStats | null }
  | { type: 'SET_CURRENT_REPOSITORY'; payload: string | null }
  | { type: 'SET_LAST_PROCESSED_FILES'; payload: string[] | null }
  | { type: 'RESET_STATE' };

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    case 'SET_HEALTH_STATUS':
      return { ...state, healthStatus: action.payload };
    case 'SET_DATABASE_STATUS':
      return { ...state, databaseStatus: action.payload };
    case 'SET_PROCESSING_STATS':
      return { ...state, processingStats: action.payload };
    case 'SET_CURRENT_REPOSITORY':
      return { ...state, currentRepository: action.payload };
    case 'SET_LAST_PROCESSED_FILES':
      return { ...state, lastProcessedFiles: action.payload };
    case 'RESET_STATE':
      return { ...initialState, isConnected: state.isConnected };
    default:
      return state;
  }
}

// Context type
interface AppContextType {
  state: AppState;
  actions: {
    checkConnectivity: () => Promise<void>;
    refreshHealthStatus: () => Promise<void>;
    refreshDatabaseStatus: () => Promise<void>;
    setCurrentRepository: (repo: string | null) => void;
    setLastProcessedFiles: (files: string[] | null) => void;
    resetState: () => void;
  };
}

// Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Actions
  const actions = {
    async checkConnectivity() {
      try {
        const isConnected = await apiService.checkConnectivity();
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: isConnected });
        
        if (isConnected) {
          // Also refresh health status when connection is established
          await actions.refreshHealthStatus();
          await actions.refreshDatabaseStatus();
        }
      } catch (error) {
        console.error('Connectivity check failed:', error);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
        dispatch({ type: 'SET_HEALTH_STATUS', payload: null });
        dispatch({ type: 'SET_DATABASE_STATUS', payload: null });
      }
    },

    async refreshHealthStatus() {
      try {
        const healthStatus = await apiService.getHealth();
        dispatch({ type: 'SET_HEALTH_STATUS', payload: healthStatus });
      } catch (error) {
        console.error('Health status check failed:', error);
        dispatch({ type: 'SET_HEALTH_STATUS', payload: null });
      }
    },

    async refreshDatabaseStatus() {
      try {
        const databaseStatus = await apiService.getDatabaseStatus();
        dispatch({ type: 'SET_DATABASE_STATUS', payload: databaseStatus });
      } catch (error) {
        console.error('Database status check failed:', error);
        dispatch({ type: 'SET_DATABASE_STATUS', payload: null });
      }
    },

    setCurrentRepository(repo: string | null) {
      dispatch({ type: 'SET_CURRENT_REPOSITORY', payload: repo });
    },

    setLastProcessedFiles(files: string[] | null) {
      dispatch({ type: 'SET_LAST_PROCESSED_FILES', payload: files });
    },

    resetState() {
      dispatch({ type: 'RESET_STATE' });
    },
  };

  // Auto-check connectivity on mount and periodically
  useEffect(() => {
    // Initial connectivity check
    actions.checkConnectivity();

    // Set up periodic connectivity checks every 30 seconds
    const interval = setInterval(() => {
      if (!state.isConnected) {
        actions.checkConnectivity();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [state.isConnected]);

  // Auto-refresh health status periodically when connected
  useEffect(() => {
    if (!state.isConnected) return;

    const interval = setInterval(() => {
      actions.refreshHealthStatus();
      actions.refreshDatabaseStatus();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [state.isConnected]);

  const contextValue: AppContextType = {
    state,
    actions,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Convenience hooks for specific state parts
export function useAppState() {
  const { state } = useApp();
  return state;
}

export function useAppActions() {
  const { actions } = useApp();
  return actions;
}

export function useConnectivity() {
  const { state, actions } = useApp();
  return {
    isConnected: state.isConnected,
    checkConnectivity: actions.checkConnectivity,
  };
}

export function useHealthStatus() {
  const { state, actions } = useApp();
  return {
    healthStatus: state.healthStatus,
    refreshHealthStatus: actions.refreshHealthStatus,
  };
}

export function useDatabaseStatus() {
  const { state, actions } = useApp();
  return {
    databaseStatus: state.databaseStatus,
    refreshDatabaseStatus: actions.refreshDatabaseStatus,
  };
}

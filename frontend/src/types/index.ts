/**
 * Type definitions for the Code Chatter application
 */

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ProcessingResponse {
  message: string;
  documents_processed: number;
  processing_time_seconds?: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  database_status: string;
  uptime_seconds: number;
}

export interface FileProcessingStats {
  total_files: number;
  processed_files: number;
  skipped_files: number;
  failed_files: number;
  processing_time_seconds: number;
}

export interface DatabaseStatus {
  status: "healthy" | "available" | "not_available" | "error";
  message: string;
  document_count: number | string;
  collection_name?: string;
}

export interface RepositoryInfo {
  active_branch: string;
  commit_count: number;
  latest_commit: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
  remotes: string[];
  is_dirty: boolean;
}

export interface RepositoryStructure {
  repository_info: RepositoryInfo;
  total_files: number;
  file_types: Record<string, number>;
  largest_file_types: [string, number][];
}

export interface SourceDocument {
  content: string;
  metadata: Record<string, any>;
}

export interface ChatResponse {
  answer: string;
  sources: SourceDocument[];
}

export interface SuggestedQuestionsResponse {
  suggestions: string[];
}

// UI State Types
export interface Message {
  id: string;
  sender: "user" | "bot";
  content: string;
  timestamp: Date;
  sources?: SourceDocument[];
  isStreaming?: boolean;
}

export interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  isProcessing: boolean;
  currentInput: string;
  suggestedQuestions: string[];
  isReady: boolean;
}

export interface AppState {
  isConnected: boolean;
  healthStatus: HealthResponse | null;
  databaseStatus: DatabaseStatus | null;
  processingStats: FileProcessingStats | null;
  currentRepository: string | null;
  lastProcessedFiles: string[] | null;
}

export interface UploadState {
  files: File[];
  isUploading: boolean;
  uploadProgress: number;
  isDragOver: boolean;
}

// Processing Status
export type ProcessingStatus = "idle" | "processing" | "completed" | "error";

export interface ProcessingState {
  status: ProcessingStatus;
  progress: number;
  message: string;
  error?: string;
}

// Theme and UI
export type Theme = "light" | "dark" | "system";

export interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  currentView: "chat" | "dashboard" | "settings";
}

// API Endpoints
export interface ApiEndpoints {
  health: string;
  processRepo: string;
  processFiles: string;
  ask: string;
  askSync: string;
  suggestedQuestions: string;
  analyzeRepoStructure: string;
  resetDatabase: string;
  databaseStatus: string;
  tasks: string;
  chatbot: string;
  chatbotSync: string;
  chatbotHealth: string;
}

// Error Types
export class ApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class StreamingError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = "StreamingError";
  }
}

// Form Types
export interface RepositoryForm {
  url: string;
}

export interface QuestionForm {
  text: string;
}

// Component Props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

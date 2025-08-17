/**
 * API Configuration and constants
 */

import { ApiEndpoints } from "@/types";

// API Configuration
export const API_CONFIG = {
  BASE_URL:
    (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/v1",
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// API Endpoints
export const API_ENDPOINTS: ApiEndpoints = {
  health: "/health",
  processRepo: "/process-repo",
  processFiles: "/process-files",
  ask: "/ask",
  askSync: "/ask-sync",
  suggestedQuestions: "/suggested-questions",
  analyzeRepoStructure: "/analyze-repo-structure",
  resetDatabase: "/reset-database",
  databaseStatus: "/database-status",
  tasks: "/tasks",
  chatbot: "/chatbot",
  chatbotSync: "/chatbot-sync",
  chatbotHealth: "/chatbot-health",
} as const;

// Request Headers
export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
} as const;

// Response status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202, // Important for background tasks
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

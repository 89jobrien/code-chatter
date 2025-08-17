/**
 * API Service Layer - Handles all backend communication
 */

import {
  ProcessingResponse,
  HealthResponse,
  DatabaseStatus,
  RepositoryStructure,
  ChatResponse,
  SuggestedQuestionsResponse,
  FileProcessingStats,
  RepositoryForm,
  QuestionForm,
} from '@/types';
import { httpClient } from './http-client';
import { API_ENDPOINTS } from './config';

export class ApiService {
  // Health and Status
  async getHealth(): Promise<HealthResponse> {
    return httpClient.get<HealthResponse>(API_ENDPOINTS.health);
  }

  async getDatabaseStatus(): Promise<DatabaseStatus> {
    return httpClient.get<DatabaseStatus>(API_ENDPOINTS.databaseStatus);
  }

  async resetDatabase(): Promise<{ message: string }> {
    return httpClient.post<{ message: string }>(API_ENDPOINTS.resetDatabase);
  }

  // Repository Processing
  async processRepository(data: RepositoryForm): Promise<ProcessingResponse> {
    return httpClient.post<ProcessingResponse>(API_ENDPOINTS.processRepo, data);
  }

  async analyzeRepositoryStructure(data: RepositoryForm): Promise<RepositoryStructure> {
    return httpClient.post<RepositoryStructure>(API_ENDPOINTS.analyzeRepoStructure, data);
  }

  // File Processing
  async processFiles(files: File[]): Promise<ProcessingResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return httpClient.post<ProcessingResponse>(
      API_ENDPOINTS.processFiles,
      formData,
      {
        headers: {}, // Let browser set Content-Type for FormData
      }
    );
  }

  // Chat and Q&A
  async askQuestionSync(question: QuestionForm): Promise<ChatResponse> {
    return httpClient.post<ChatResponse>(API_ENDPOINTS.askSync, question);
  }

  async askQuestionStreaming(
    question: QuestionForm,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    return httpClient.stream(
      API_ENDPOINTS.ask,
      question,
      onChunk
    );
  }

  async getSuggestedQuestions(): Promise<SuggestedQuestionsResponse> {
    return httpClient.get<SuggestedQuestionsResponse>(API_ENDPOINTS.suggestedQuestions);
  }

  // Chatbot methods
  async askChatbotSync(question: QuestionForm): Promise<{ response: string; type: string }> {
    return httpClient.post<{ response: string; type: string }>(API_ENDPOINTS.chatbotSync, question);
  }

  async askChatbotStreaming(
    question: QuestionForm,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    return httpClient.stream(
      API_ENDPOINTS.chatbot,
      question,
      onChunk
    );
  }

  async getChatbotHealth(): Promise<{ chatbot_status: string; ready: boolean }> {
    return httpClient.get<{ chatbot_status: string; ready: boolean }>(API_ENDPOINTS.chatbotHealth);
  }

  // Utility methods for common patterns
  async checkIfReady(): Promise<boolean> {
    try {
      const status = await this.getDatabaseStatus();
      return status.status === 'healthy' || status.status === 'available';
    } catch {
      return false;
    }
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      await this.getHealth();
      return true;
    } catch {
      return false;
    }
  }

  // Process repository with progress tracking
  async processRepositoryWithProgress(
    data: RepositoryForm,
    onProgress?: (message: string) => void
  ): Promise<ProcessingResponse> {
    onProgress?.('Validating repository URL...');
    
    try {
      // First analyze the structure to give user feedback
      onProgress?.('Analyzing repository structure...');
      const structure = await this.analyzeRepositoryStructure(data);
      
      onProgress?.(`Processing ${structure.total_files} files...`);
      
      // Then process the repository
      const result = await this.processRepository(data);
      
      onProgress?.(`Successfully processed ${result.documents_processed} documents`);
      
      return result;
    } catch (error) {
      onProgress?.('Processing failed');
      throw error;
    }
  }

  // Process files with progress tracking
  async processFilesWithProgress(
    files: File[],
    onProgress?: (progress: number, message: string) => void
  ): Promise<ProcessingResponse> {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    let processedSize = 0;

    onProgress?.(0, `Preparing to upload ${files.length} files...`);
    
    // Simulate progress during upload
    const progressInterval = setInterval(() => {
      processedSize += totalSize * 0.1; // Simulate 10% progress increments
      if (processedSize >= totalSize) {
        clearInterval(progressInterval);
        return;
      }
      const progress = Math.min((processedSize / totalSize) * 80, 80); // Cap at 80% for upload
      onProgress?.(progress, 'Uploading files...');
    }, 500);

    try {
      const result = await this.processFiles(files);
      
      clearInterval(progressInterval);
      onProgress?.(100, `Successfully processed ${result.documents_processed} documents`);
      
      return result;
    } catch (error) {
      clearInterval(progressInterval);
      onProgress?.(0, 'Processing failed');
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;

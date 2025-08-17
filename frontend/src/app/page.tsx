'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { FileUploadZone } from '@/components/upload/FileUploadZone';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useChatActions } from '@/contexts/ChatContext';
import { useConnectivity, useAppActions } from '@/contexts/AppContext';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { Loader2, GitBranch, Upload, MessageCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [isProcessingRepo, setIsProcessingRepo] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [currentView, setCurrentView] = useState<'setup' | 'chat'>('setup');
  
  const { setReady, addSystemMessage } = useChatActions();
  const { isConnected } = useConnectivity();
  const { setCurrentRepository, setLastProcessedFiles } = useAppActions();

  // Repository processing
  const handleRepoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      toast.error('Please enter a repository URL.');
      return;
    }

    setIsProcessingRepo(true);

    try {
      const result = await apiService.processRepositoryWithProgress(
        { url: repoUrl },
        (message) => {
          toast.loading(message, { id: 'repo-processing' });
        }
      );

      toast.success(`Successfully processed ${result.documents_processed} files from repository!`, {
        id: 'repo-processing'
      });

      // Update app state
      setCurrentRepository(repoUrl);
      setReady(true);
      addSystemMessage(
        `🎉 Repository processed successfully! I've analyzed ${result.documents_processed} documents from the repository. You can now ask me questions about the codebase.`
      );
      setCurrentView('chat');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process repository';
      toast.error(errorMessage, { id: 'repo-processing' });
      console.error('Repository processing failed:', error);
    } finally {
      setIsProcessingRepo(false);
    }
  };

  // File processing
  const handleFilesSelected = async (files: FileList) => {
    if (files.length === 0) return;

    const fileArray = Array.from(files);
    setIsProcessingFiles(true);
    setUploadProgress(0);
    setUploadMessage(`Preparing to upload ${fileArray.length} files...`);

    try {
      const result = await apiService.processFilesWithProgress(
        fileArray,
        (progress, message) => {
          setUploadProgress(progress);
          setUploadMessage(message);
        }
      );

      toast.success(`Successfully processed ${result.documents_processed} files!`);

      // Update app state
      setLastProcessedFiles(fileArray.map(f => f.name));
      setReady(true);
      addSystemMessage(
        `📁 Files processed successfully! I've analyzed ${result.documents_processed} documents from ${fileArray.length} uploaded files. You can now ask me questions about your code.`
      );
      setCurrentView('chat');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process files';
      toast.error(errorMessage);
      console.error('File processing failed:', error);
    } finally {
      setIsProcessingFiles(false);
      setUploadProgress(0);
      setUploadMessage('');
    }
  };

  const handleBackToSetup = () => {
    setCurrentView('setup');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Sparkles className="h-6 w-6 text-primary" />
              <div className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Code Analysis
            </h1>
          </div>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Upload files or connect repositories to start analyzing your codebase with AI.
          </p>
          
          {!isConnected && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg inline-block">
              <p className="text-sm text-destructive">⚠️ Unable to connect to server. Please check your connection.</p>
            </div>
          )}
        </div>

        {currentView === 'setup' ? (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Repository Processing */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Process Repository</CardTitle>
                    <CardDescription>
                      Connect to a Git repository for comprehensive codebase analysis
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleRepoSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="repoUrl" className="text-sm font-medium">
                      Repository URL
                    </Label>
                    <div className="flex gap-3">
                      <Input
                        id="repoUrl"
                        type="url"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/username/repository"
                        disabled={isProcessingRepo || !isConnected}
                        className="flex-1"
                      />
                      <Button 
                        type="submit" 
                        disabled={isProcessingRepo || !isConnected || !repoUrl.trim()}
                        className="shrink-0"
                      >
                        {isProcessingRepo ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <GitBranch className="mr-2 h-4 w-4" />
                            Process Repository
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-3 py-1 text-muted-foreground rounded-full border">
                  Or
                </span>
              </div>
            </div>

            {/* File Upload */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary/20 via-secondary to-secondary/20" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <Upload className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Upload Files</CardTitle>
                    <CardDescription>
                      Upload individual files or entire folders for analysis
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <FileUploadZone
                  onFilesSelected={handleFilesSelected}
                  disabled={!isConnected}
                  isUploading={isProcessingFiles}
                  uploadProgress={uploadProgress}
                  uploadMessage={uploadMessage}
                  maxFiles={100}
                  maxFileSize={50}
                />
              </CardContent>
            </Card>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <MessageCircle className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Intelligent Chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask natural language questions about your code and get detailed explanations.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <GitBranch className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Repository Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Analyze entire repositories with understanding of project structure.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <Upload className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">File Upload</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload multiple files or folders with drag-and-drop support.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Chat View
          <div className="max-w-6xl mx-auto h-[calc(100vh-10rem)]">
            <div className="mb-4 flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={handleBackToSetup}
                className="text-muted-foreground"
              >
                ← Back to Setup
              </Button>
            </div>
            <ChatInterface className="h-full" />
          </div>
        )}
      </div>
    </main>
  );
}

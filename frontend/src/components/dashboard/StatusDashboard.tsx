'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAppState, useHealthStatus, useDatabaseStatus } from '@/contexts/AppContext';
import { useMessages } from '@/contexts/ChatContext';
import { 
  Activity, 
  Database, 
  MessageSquare, 
  GitBranch, 
  FileText, 
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatusDashboard() {
  const appState = useAppState();
  const { healthStatus } = useHealthStatus();
  const { databaseStatus } = useDatabaseStatus();
  const messages = useMessages();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'available':
        return 'text-green-500';
      case 'degraded':
      case 'not_available':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'available':
        return CheckCircle;
      case 'degraded':
      case 'not_available':
        return AlertCircle;
      case 'error':
        return XCircle;
      default:
        return Activity;
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const userMessages = messages.filter(m => m.sender === 'user');
  const botMessages = messages.filter(m => m.sender === 'bot');

  return (
    <div className="space-y-6">
      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            <Activity className={cn('h-4 w-4', getStatusColor(appState.isConnected ? 'healthy' : 'error'))} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={appState.isConnected ? 'default' : 'destructive'}>
                {appState.isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Health</CardTitle>
            {healthStatus && (() => {
              const StatusIcon = getStatusIcon(healthStatus.status);
              return <StatusIcon className={cn('h-4 w-4', getStatusColor(healthStatus.status))} />;
            })()}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStatus ? (
                <Badge variant={healthStatus.status === 'healthy' ? 'default' : 'secondary'}>
                  {healthStatus.status}
                </Badge>
              ) : (
                <Badge variant="outline">Unknown</Badge>
              )}
            </div>
            {healthStatus && (
              <p className="text-xs text-muted-foreground">
                v{healthStatus.version} • {formatUptime(healthStatus.uptime_seconds)} uptime
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            {databaseStatus && (() => {
              const StatusIcon = getStatusIcon(databaseStatus.status);
              return <StatusIcon className={cn('h-4 w-4', getStatusColor(databaseStatus.status))} />;
            })()}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typeof databaseStatus?.document_count === 'number' 
                ? databaseStatus.document_count.toLocaleString()
                : '0'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {databaseStatus ? databaseStatus.message : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages.length}</div>
            <p className="text-xs text-muted-foreground">
              {userMessages.length} sent, {botMessages.length} received
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Session */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Current Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <GitBranch className="h-4 w-4" />
                Repository
              </div>
              {appState.currentRepository ? (
                <div className="text-sm text-muted-foreground">
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    {appState.currentRepository}
                  </code>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No repository processed
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <FileText className="h-4 w-4" />
                Uploaded Files
              </div>
              {appState.lastProcessedFiles && appState.lastProcessedFiles.length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  {appState.lastProcessedFiles.length} files processed
                  <div className="mt-1 max-h-20 overflow-y-auto">
                    {appState.lastProcessedFiles.slice(0, 3).map((file, index) => (
                      <div key={index} className="text-xs font-mono bg-muted px-2 py-1 rounded mb-1">
                        {file}
                      </div>
                    ))}
                    {appState.lastProcessedFiles.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{appState.lastProcessedFiles.length - 3} more files
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No files uploaded
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      {appState.processingStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Last Processing Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {appState.processingStats.processed_files}
                </div>
                <p className="text-xs text-muted-foreground">Processed Files</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {appState.processingStats.skipped_files}
                </div>
                <p className="text-xs text-muted-foreground">Skipped Files</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {appState.processingStats.failed_files}
                </div>
                <p className="text-xs text-muted-foreground">Failed Files</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {appState.processingStats.processing_time_seconds.toFixed(1)}s
                </div>
                <p className="text-xs text-muted-foreground">Processing Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

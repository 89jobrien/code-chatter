'use client';

import React, { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, X, File, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFilesSelected: (files: FileList) => void;
  onUploadProgress?: (progress: number, message: string) => void;
  disabled?: boolean;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  maxFileSize?: number; // in MB
  className?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadMessage?: string;
}

export function FileUploadZone({
  onFilesSelected,
  onUploadProgress,
  disabled = false,
  acceptedFileTypes = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
    '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.scala',
    '.html', '.css', '.scss', '.sass', '.less', '.xml', '.yaml', '.yml',
    '.json', '.toml', '.ini', '.cfg', '.conf', '.txt', '.md', '.rst',
    '.sql', '.sh', '.bash', '.dockerfile'
  ],
  maxFiles = 50,
  maxFileSize = 10, // 10MB default
  className,
  isUploading = false,
  uploadProgress = 0,
  uploadMessage,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input value to allow selecting same files again
    e.target.value = '';
  };

  const validateFile = (file: File): { valid: boolean; reason?: string } => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return { valid: false, reason: `File "${file.name}" exceeds ${maxFileSize}MB limit` };
    }

    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (acceptedFileTypes.length > 0 && !acceptedFileTypes.includes(extension)) {
      return { valid: false, reason: `File type "${extension}" is not supported` };
    }

    return { valid: true };
  };

  const handleFiles = (files: FileList) => {
    const fileArray = Array.from(files);
    
    // Validate files
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(validation.reason!);
      }
    }

    // Check max files limit
    if (validFiles.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      validFiles.splice(maxFiles);
    }

    // Show errors if any
    if (errors.length > 0) {
      console.warn('File validation errors:', errors);
      // You might want to show these errors in a toast or alert
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      
      // Create FileList from valid files
      const dt = new DataTransfer();
      validFiles.forEach(file => dt.items.add(file));
      onFilesSelected(dt.files);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    if (newFiles.length === 0) {
      return;
    }

    // Create new FileList
    const dt = new DataTransfer();
    newFiles.forEach(file => dt.items.add(file));
    onFilesSelected(dt.files);
  };

  const clearFiles = () => {
    setSelectedFiles([]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Zone */}
      <Card
        className={cn(
          'border-2 border-dashed transition-colors',
          isDragOver && !disabled && !isUploading && 'border-primary bg-primary/5',
          disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          !disabled && !isUploading && 'hover:border-primary/50 hover:bg-primary/5'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Upload className={cn(
            'h-10 w-10 mb-4',
            isDragOver && !disabled ? 'text-primary' : 'text-muted-foreground'
          )} />
          
          <div className="space-y-2">
            <p className="text-lg font-semibold">
              {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse files
            </p>
            <p className="text-xs text-muted-foreground">
              Max {maxFiles} files, {maxFileSize}MB each
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={disabled || isUploading}
            >
              <File className="h-4 w-4 mr-2" />
              Select Files
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              disabled={disabled || isUploading}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Select Folder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFileTypes.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-ignore - webkitdirectory is not in types but works
        webkitdirectory=""
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Selected Files List */}
      {selectedFiles.length > 0 && !isUploading && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">
                Selected Files ({selectedFiles.length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFiles}
                className="text-muted-foreground hover:text-destructive"
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="text-muted-foreground hover:text-destructive ml-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Uploading files...</p>
                <p className="text-sm text-muted-foreground">{uploadProgress}%</p>
              </div>
              <Progress value={uploadProgress} className="w-full" />
              {uploadMessage && (
                <p className="text-sm text-muted-foreground">{uploadMessage}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

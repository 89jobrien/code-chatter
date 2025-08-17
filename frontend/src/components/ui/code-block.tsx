'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: string;
  language?: string;
  filename?: string;
  showCopyButton?: boolean;
  showDownloadButton?: boolean;
  className?: string;
}

export function CodeBlock({
  children,
  language = 'text',
  filename,
  showCopyButton = true,
  showDownloadButton = false,
  className
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([children], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `code.${getFileExtension(language)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileExtension = (lang: string): string => {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      'c++': 'cpp',
      c: 'c',
      csharp: 'cs',
      'c#': 'cs',
      php: 'php',
      ruby: 'rb',
      go: 'go',
      rust: 'rs',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      json: 'json',
      yaml: 'yaml',
      yml: 'yml',
      xml: 'xml',
      markdown: 'md',
      sql: 'sql',
      bash: 'sh',
      shell: 'sh',
      powershell: 'ps1',
      dockerfile: 'Dockerfile',
    };
    return extensions[lang.toLowerCase()] || 'txt';
  };

  const getLanguageDisplay = (lang: string): string => {
    const displayNames: Record<string, string> = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      java: 'Java',
      cpp: 'C++',
      'c++': 'C++',
      c: 'C',
      csharp: 'C#',
      'c#': 'C#',
      php: 'PHP',
      ruby: 'Ruby',
      go: 'Go',
      rust: 'Rust',
      swift: 'Swift',
      kotlin: 'Kotlin',
      scala: 'Scala',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      sass: 'Sass',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      xml: 'XML',
      markdown: 'Markdown',
      sql: 'SQL',
      bash: 'Bash',
      shell: 'Shell',
      powershell: 'PowerShell',
      dockerfile: 'Dockerfile',
      text: 'Text',
    };
    return displayNames[lang.toLowerCase()] || lang.toUpperCase();
  };

  return (
    <div className={cn("relative group my-3", className)}>
      {/* Header with language and filename */}
      {(language !== 'text' || filename) && (
        <div className="flex items-center justify-between bg-muted/50 border border-b-0 rounded-t-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500/70"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/70"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/70"></div>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {filename || getLanguageDisplay(language)}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {showDownloadButton && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                onClick={handleDownload}
                title="Download code"
              >
                <Download className="h-3 w-3" />
              </Button>
            )}
            
            {showCopyButton && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                onClick={handleCopy}
                title="Copy code"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Code content */}
      <div className="relative">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            borderRadius: (language !== 'text' || filename) ? '0 0 0.375rem 0.375rem' : '0.375rem',
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
          PreTag="div"
          showLineNumbers={children.split('\n').length > 3}
          wrapLines={true}
          wrapLongLines={true}
        >
          {children}
        </SyntaxHighlighter>

        {/* Floating copy button for text blocks without header */}
        {language === 'text' && !filename && showCopyButton && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
            onClick={handleCopy}
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

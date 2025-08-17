'use client';

import React from 'react';
import { CodeBlock } from './code-block';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  children: string;
  className?: string;
}

interface ParsedContent {
  type: 'text' | 'code' | 'inline-code';
  content: string;
  language?: string;
  filename?: string;
}

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  const parseContent = (content: string): ParsedContent[] => {
    const parts: ParsedContent[] = [];
    
    // First, handle code blocks (```language\ncode```)
    const codeBlockRegex = /```(?:(\w+)(?:\s*:\s*(.+?))?)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index);
        parts.push(...parseInlineElements(textBefore));
      }

      // Add code block
      const language = match[1] || 'text';
      const filename = match[2] || undefined;
      const code = match[3].trim();
      
      parts.push({
        type: 'code',
        content: code,
        language,
        filename
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex);
      parts.push(...parseInlineElements(remainingText));
    }

    return parts.length > 0 ? parts : parseInlineElements(content);
  };

  const parseInlineElements = (text: string): ParsedContent[] => {
    const parts: ParsedContent[] = [];
    
    // Handle inline code (`code`)
    const inlineCodeRegex = /`([^`]+)`/g;
    let lastIndex = 0;
    let match;

    while ((match = inlineCodeRegex.exec(text)) !== null) {
      // Add text before inline code
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }

      // Add inline code
      parts.push({
        type: 'inline-code',
        content: match[1]
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  };

  const formatText = (text: string) => {
    // Handle basic markdown formatting
    return text
      .split('\n')
      .map((line, index) => {
        // Handle headers
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>;
        }
        
        // Handle lists
        if (line.match(/^[-\*\+]\s/)) {
          return <li key={index} className="ml-4">{line.slice(2)}</li>;
        }
        if (line.match(/^\d+\.\s/)) {
          return <li key={index} className="ml-4">{line.replace(/^\d+\.\s/, '')}</li>;
        }
        
        // Handle bold and italic
        let formattedLine = line;
        
        // Bold (**text** or __text__)
        formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedLine = formattedLine.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Italic (*text* or _text_)
        formattedLine = formattedLine.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        formattedLine = formattedLine.replace(/_([^_]+)_/g, '<em>$1</em>');
        
        // Regular paragraph or empty line
        if (line.trim() === '') {
          return <br key={index} />;
        }
        
        return (
          <span
            key={index}
            dangerouslySetInnerHTML={{ __html: formattedLine }}
            className="block"
          />
        );
      });
  };

  const renderContent = () => {
    const parts = parseContent(children);

    return parts.map((part, index) => {
      switch (part.type) {
        case 'code':
          return (
            <CodeBlock
              key={index}
              language={part.language}
              filename={part.filename}
              showCopyButton={true}
              showDownloadButton={part.content.length > 200} // Show download for longer code blocks
            >
              {part.content}
            </CodeBlock>
          );
        
        case 'inline-code':
          return (
            <code
              key={index}
              className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono border"
            >
              {part.content}
            </code>
          );
        
        case 'text':
          return (
            <div key={index} className="leading-relaxed">
              {formatText(part.content)}
            </div>
          );
        
        default:
          return null;
      }
    });
  };

  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      {renderContent()}
    </div>
  );
}

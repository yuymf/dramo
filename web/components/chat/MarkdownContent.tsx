'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  isStreaming?: boolean;
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0" style={{ lineHeight: 1.7 }}>
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm" style={{ lineHeight: 1.6 }}>
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block bg-[var(--at-surface-alt,#f5f0eb)] rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto my-2">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-[var(--at-surface-alt,#f5f0eb)] rounded px-1.5 py-0.5 text-xs font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="overflow-x-auto my-2">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--at-border)] pl-3 my-2 opacity-80 italic">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
  ),
  a: ({ href, children }) => {
    const safeHref = href && /^(https?:\/\/|mailto:|#)/.test(href) ? href : '#';
    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--at-accent)] underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  hr: () => <hr className="my-3 border-[var(--at-border-light)]" />,
};

/**
 * Render markdown content from AI assistant messages.
 * Shows a blinking cursor when streaming.
 * MUJI-style typography: Songti SC body, ample line-height, muted accents.
 */
export function MarkdownContent({ content, isStreaming }: MarkdownContentProps) {
  return (
    <div
      className="text-sm prose-sm max-w-none"
      style={{ fontFamily: '"Songti SC", Georgia, serif' }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-[2px] h-[1em] bg-[var(--at-text)] animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}

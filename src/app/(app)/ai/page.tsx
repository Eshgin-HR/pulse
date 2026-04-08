'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Send, User, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const quickActions = [
  'Weekly summary',
  "What's overdue?",
  'Priority recommendations',
  'What should I focus on today?',
];

export default function AskAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      });

      const data = await res.json();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.error || 'Something went wrong.',
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Failed to connect. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Simple markdown-ish rendering: bold, lists, line breaks
  function renderContent(text: string) {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      processed = processed.replace(/`(.*?)`/g, '<code class="text-xs bg-subtle px-1 py-0.5 rounded font-mono">$1</code>');

      // List items
      if (/^[-*]\s/.test(line)) {
        const content = processed.replace(/^[-*]\s/, '');
        return (
          <div key={i} className="flex gap-2 py-0.5">
            <span className="text-tx-muted shrink-0 mt-0.5">-</span>
            <span dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        );
      }

      // Numbered list
      if (/^\d+\.\s/.test(line)) {
        const match = line.match(/^(\d+)\.\s(.*)/);
        if (match) {
          const content = processed.replace(/^\d+\.\s/, '');
          return (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="text-tx-muted shrink-0 mt-0.5 tabular-nums">{match[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          );
        }
      }

      // Headers
      if (/^###\s/.test(line)) {
        return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.replace(/^###\s/, '')}</h4>;
      }
      if (/^##\s/.test(line)) {
        return <h3 key={i} className="font-semibold text-sm mt-3 mb-1">{line.replace(/^##\s/, '')}</h3>;
      }
      if (/^#\s/.test(line)) {
        return <h2 key={i} className="font-bold text-base mt-3 mb-1">{line.replace(/^#\s/, '')}</h2>;
      }

      // Empty line
      if (!line.trim()) return <div key={i} className="h-2" />;

      // Regular paragraph
      return <p key={i} className="py-0.5" dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-96px)] max-w-[800px] mx-auto">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            {/* Empty state */}
            <div className="w-12 h-12 rounded-2xl bg-brand-subtle flex items-center justify-center">
              <Sparkles size={24} className="text-brand" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-tx-primary mb-1">Ask PULSE AI</h2>
              <p className="text-sm text-tx-muted max-w-sm">
                Ask about your tasks, get priority recommendations, or request a summary of your work.
              </p>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-tx-secondary hover:text-tx-primary hover:border-border-strong transition-all"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3 mb-4',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={14} className="text-brand" />
              </div>
            )}

            <div
              className={cn(
                'rounded-xl px-4 py-3 max-w-[85%] text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-brand text-white'
                  : 'card-gradient text-tx-primary'
              )}
            >
              {msg.role === 'assistant' ? (
                <div className="space-y-0">{renderContent(msg.content)}</div>
              ) : (
                msg.content
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-subtle flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-tx-muted" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3 mb-4">
            <div className="w-7 h-7 rounded-lg bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={14} className="text-brand" />
            </div>
            <div className="card-gradient rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-tx-muted">
                <Loader2 size={14} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick actions bar (visible when there are messages) */}
      {messages.length > 0 && (
        <div className="flex gap-2 pb-3 px-1 overflow-x-auto">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-tx-muted hover:text-tx-secondary hover:border-border-strong transition-all whitespace-nowrap disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border pt-4 pb-2">
        <div className="flex items-center gap-2 bg-subtle border border-border rounded-xl px-4 py-2.5 focus-within:border-brand transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your tasks, priorities, or workload..."
            className="flex-1 bg-transparent text-sm text-tx-primary placeholder:text-tx-muted outline-none"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              input.trim() && !loading
                ? 'bg-brand text-white hover:bg-brand-hover'
                : 'text-tx-muted/40'
            )}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-tx-muted text-center mt-2">
          PULSE AI has access to all your tasks and portfolios
        </p>
      </div>
    </div>
  );
}

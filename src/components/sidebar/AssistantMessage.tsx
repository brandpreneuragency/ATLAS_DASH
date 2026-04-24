import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, PenLine } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../types';
import type { Editor } from '@tiptap/react';
import { formatRelativeTime } from '../../utils/timeFormat';

interface AssistantMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  editor: Editor | null;
}

// ---------------------------------------------------------------------------
// Thinking-tag parser: splits <think>...</think> from the actual answer
// ---------------------------------------------------------------------------
function parseThinking(raw: string) {
  const openMatch = raw.match(/^[\s]*<think>/);
  if (!openMatch) return { thinking: null, thinkingDone: true, content: raw };
  const afterOpen = raw.slice(openMatch[0].length);
  const closeIdx = afterOpen.indexOf('</think>');
  if (closeIdx === -1) return { thinking: afterOpen, thinkingDone: false, content: '' };
  return {
    thinking: afterOpen.slice(0, closeIdx).trim(),
    thinkingDone: true,
    content: afterOpen.slice(closeIdx + 8).trim(),
  };
}

// ---------------------------------------------------------------------------
// Split markdown into a preamble + collapsible H3 sections
// ---------------------------------------------------------------------------
type Part =
  | { type: 'preamble'; content: string }
  | { type: 'section'; heading: string; content: string };

function splitAtH3(md: string): Part[] {
  const lines = md.split('\n');
  const parts: Part[] = [];
  let buffer: string[] = [];
  let heading: string | null = null;

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (heading !== null) {
      parts.push({ type: 'section', heading, content });
    } else if (content) {
      parts.push({ type: 'preamble', content });
    }
    buffer = [];
    heading = null;
  };

  for (const line of lines) {
    const m = line.match(/^### (.+)/);
    if (m) { flush(); heading = m[1]; }
    else buffer.push(line);
  }
  flush();
  return parts;
}

// ---------------------------------------------------------------------------
// Shared markdown renderer
// ---------------------------------------------------------------------------
function MdContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: c }) => (
          <p className="mb-2 last:mb-0 text-[12px] text-text-primary leading-relaxed">{c}</p>
        ),
        h1: ({ children: c }) => <h1 className="text-sm font-bold mb-2 text-text-primary">{c}</h1>,
        h2: ({ children: c }) => <h2 className="text-[13px] font-bold mb-2 text-text-primary">{c}</h2>,
        h3: ({ children: c }) => <h3 className="text-[12px] font-semibold mb-1 text-text-primary">{c}</h3>,
        h4: ({ children: c }) => <h4 className="text-[12px] font-semibold mb-1 text-text-secondary">{c}</h4>,
        ul: ({ children: c }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5 text-[12px] text-text-primary">{c}</ul>,
        ol: ({ children: c }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5 text-[12px] text-text-primary">{c}</ol>,
        li: ({ children: c }) => <li className="leading-relaxed">{c}</li>,
        strong: ({ children: c }) => <strong className="font-semibold text-text-primary">{c}</strong>,
        em: ({ children: c }) => <em className="italic">{c}</em>,
        blockquote: ({ children: c }) => (
          <blockquote className="border-l-2 border-brand/40 pl-3 italic text-text-secondary mb-2 text-[12px]">{c}</blockquote>
        ),
        pre: ({ children: c }) => (
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-[11px] font-mono mb-2 leading-relaxed whitespace-pre">{c}</pre>
        ),
        code: ({ node, children: c, className, ...props }: any) => {
          const isBlock = /language-/.test(className || '') ||
            (node?.position && node.position.end.line > node.position.start.line);
          return isBlock
            ? <code className={`font-mono text-[11px] ${className || ''}`} {...props}>{c}</code>
            : <code className="bg-gray-100 rounded px-1 py-0.5 text-[11px] font-mono text-rose-600">{c}</code>;
        },
        table: ({ children: c }) => (
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-[11px] border-collapse">{c}</table>
          </div>
        ),
        thead: ({ children: c }) => <thead className="bg-gray-50">{c}</thead>,
        th: ({ children: c }) => <th className="border border-border px-3 py-1.5 text-left font-semibold text-text-primary">{c}</th>,
        td: ({ children: c }) => <td className="border border-border px-3 py-1.5 text-text-primary">{c}</td>,
        a: ({ href, children: c }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline hover:text-brand-dark">{c}</a>
        ),
        hr: () => <hr className="border-border my-3" />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// Collapsible reasoning box
// ---------------------------------------------------------------------------
function ReasoningBox({ content, streaming }: { content: string; streaming: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded-xl border border-border bg-gray-50 overflow-hidden text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2 text-left text-text-secondary hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium">{streaming ? 'Reasoning…' : 'Reasoning'}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-text-secondary whitespace-pre-wrap border-t border-border/50 leading-relaxed max-h-64 overflow-y-auto">
          {content}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible H3 section
// ---------------------------------------------------------------------------
function SectionBlock({ heading, content, defaultOpen }: { heading: string; content: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg mb-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <ChevronRight
          size={13}
          className={`text-blue-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-[12px] font-semibold text-text-primary">{heading}</span>
      </button>
      {open && content && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40">
          <MdContent>{content}</MdContent>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function AssistantMessage({ message, isStreaming, editor }: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);
  const { thinking, thinkingDone, content } = parseThinking(message.content);
  const parts = splitAtH3(content);
  const hasSections = parts.some((p) => p.type === 'section');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content || message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyChange = () => {
    if (!editor || !message.suggestedText) return;
    const { selectionFrom: from, selectionTo: to } = message;
    if (from !== undefined && to !== undefined) {
      editor.chain().focus().setTextSelection({ from, to }).insertContent(message.suggestedText).run();
    } else {
      editor.chain().focus().insertContent(message.suggestedText).run();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Reasoning box */}
      {thinking && (
        <ReasoningBox content={thinking} streaming={!thinkingDone} />
      )}

      {/* Content card */}
      <div className="bg-white border border-border rounded-xl px-4 py-3 shadow-sm break-words overflow-hidden">
        {/* Still inside <think> block — show spinner/placeholder */}
        {isStreaming && !content && (
          <p className={`text-[12px] text-text-secondary ${thinking ? 'opacity-50' : 'streaming-cursor'}`}>
            {thinking ? 'Thinking…' : ''}
          </p>
        )}

        {/* Rendered content */}
        {content && (
          <div className={isStreaming && !hasSections ? 'streaming-cursor' : ''}>
            {hasSections ? (
              <>
                {parts.map((part, i) =>
                  part.type === 'preamble' ? (
                    <div key={i}><MdContent>{part.content}</MdContent></div>
                  ) : (
                    <SectionBlock
                      key={i}
                      heading={part.heading}
                      content={part.content}
                      defaultOpen={isStreaming ?? false}
                    />
                  )
                )}
              </>
            ) : (
              <MdContent>{content}</MdContent>
            )}
          </div>
        )}

        {/* Action row */}
        {!isStreaming && (content || message.content) && (
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy'}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            {message.suggestedText && (
              <button
                type="button"
                onClick={handleApplyChange}
                title="Apply suggestion to editor"
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <PenLine size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="text-[10px] text-text-secondary pl-1">
        {formatRelativeTime(message.timestamp)}
      </div>
    </div>
  );
}

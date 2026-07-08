import { cn } from '@/lib/utils';

export interface ChatMessageProps {
  role: 'user' | 'agent';
  text: string;
  /** Caret reserved for the future delta-streaming evolution (doc/v0-spec.md §4.3) — unused in v0. */
  streaming?: boolean;
}

/** A chat turn bubble — the `agent_message` UI binding, plus the local user half (doc/v0-spec.md §5.6). */
export function ChatMessage({ role, text, streaming = false }: ChatMessageProps) {
  return (
    <div className={cn('flex flex-col gap-1 px-3 py-2', role === 'user' ? 'items-end' : 'items-start')}>
      <span className="font-mono text-text-faint text-xs uppercase tracking-caps">{role === 'user' ? 'You' : 'Agent'}</span>
      <p
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-md border px-3 py-2 font-mono text-sm text-text',
          role === 'user' ? 'border-border-active bg-surface-2' : 'border-border-hairline bg-surface'
        )}
      >
        {text}
        {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-text-dim align-text-bottom" aria-hidden="true" />}
      </p>
    </div>
  );
}

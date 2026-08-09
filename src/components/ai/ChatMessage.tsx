import { cn } from '@/lib/utils';

export interface ChatMessageProps {
  role: 'user' | 'agent';
  text: string;
  /** Caret reserved for the future delta-streaming evolution (doc/v0-spec.md §4.3) — unused in v0. */
  streaming?: boolean;
}

/** A chat turn — the agent's answer is the accented card; the user's prompt stays subordinate. */
export function ChatMessage({ role, text, streaming = false }: ChatMessageProps) {
  const isAgent = role === 'agent';
  return (
    <div className={cn('flex px-4 py-3', isAgent ? 'items-start' : 'justify-end')}>
      {isAgent ? (
        <div className="flex max-w-[85%] gap-2 rounded-card border border-[var(--accent-border)] bg-[var(--accent-tint)] px-3 py-2.5">
          <span className="shrink-0 text-accent" aria-hidden="true">
            ✦
          </span>
          <p className="whitespace-pre-wrap font-sans text-ui leading-[var(--leading-ui)] text-text-body">
            {text}
            {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-text-muted align-text-bottom" aria-hidden="true" />}
          </p>
        </div>
      ) : (
        <p className="max-w-[85%] whitespace-pre-wrap font-sans text-ui leading-[var(--leading-ui)] text-text-secondary">
          {text}
          {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-text-muted align-text-bottom" aria-hidden="true" />}
        </p>
      )}
    </div>
  );
}

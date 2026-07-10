import { cn } from '@/lib/utils';

export interface ChatMessageProps {
  role: 'user' | 'agent';
  text: string;
  /** Caret reserved for the future delta-streaming evolution (doc/v0-spec.md §4.3) — unused in v0. */
  streaming?: boolean;
}

/**
 * A chat turn — the `agent_message` UI binding, plus the local user half (doc/v0-spec.md §5.6).
 * User turns stay quiet monochrome (no card, dim label, bone text); agent turns get the Feature
 * Card treatment (DESIGN.md): hairline border, no fill, `--radius-md` — the transcript's own
 * figure/ground move stays subtle instead of a wall of bright bone cards.
 */
export function ChatMessage({ role, text, streaming = false }: ChatMessageProps) {
  const isAgent = role === 'agent';
  return (
    <div className={cn('flex flex-col gap-1.5 px-4 py-4', isAgent ? 'items-start' : 'items-end')}>
      <span className="font-mono text-text-faint text-xs uppercase tracking-caps">{isAgent ? 'Agent' : 'You'}</span>
      <p className={cn('max-w-[85%] whitespace-pre-wrap font-sans text-sm text-text', isAgent && 'rounded-md border border-border-hairline px-3 py-2.5')}>
        {text}
        {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-text-dim align-text-bottom" aria-hidden="true" />}
      </p>
    </div>
  );
}

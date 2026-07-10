export interface ReasoningBlockProps {
  text: string;
}

/** Renders an `agent_reasoning` event — visually distinct from `ChatMessage`'s final-answer bubble: no border, dimmer, italic (#49). */
export function ReasoningBlock({ text }: ReasoningBlockProps) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      <span className="font-mono text-text-faint text-xs uppercase tracking-caps">Thinking</span>
      <p className="max-w-[85%] whitespace-pre-wrap font-mono text-sm text-text-dim italic">{text}</p>
    </div>
  );
}

/** In-flight loader shown for the duration of `turnActive`, so the agent's work is visible even between events (#49). */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 font-mono text-text-dim text-xs uppercase tracking-caps" aria-live="polite">
      <span className="animate-pulse" aria-hidden="true">
        …
      </span>
      <span>Thinking</span>
    </div>
  );
}

/**
 * In-flight loader shown for the duration of `turnActive`, so the agent's work is visible even
 * between events (#49). Rendered in signal-orange — the live/in-flight data-voice accent
 * (DESIGN.md "Status Pulse"), never a decoration.
 */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 font-mono text-signal text-xs uppercase tracking-caps" aria-live="polite">
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-signal" aria-hidden="true" />
      <span>Thinking</span>
    </div>
  );
}

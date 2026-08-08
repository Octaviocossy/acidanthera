/** In-flight loader shown for the duration of `turnActive`, including gaps between events. */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 font-mono text-label uppercase tracking-label text-accent" aria-live="polite">
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />
      <span>Thinking</span>
    </div>
  );
}

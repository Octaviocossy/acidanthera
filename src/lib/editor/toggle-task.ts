/** The three slices a GFM `TaskMarker` can be, mapped to what ticking it produces. */
const FLIPPED: Record<string, string> = {
  '[ ]': '[x]',
  '[x]': '[ ]',
  '[X]': '[ ]',
};

/**
 * Flips the task marker occupying `[markerFrom, markerTo)` and returns the rewritten source.
 *
 * The offsets come from the *markdown walker*'s parse rather than from a text search: the walk
 * slices by each node's `from`/`to`, so a rendered checkbox already knows the exact byte range that
 * produced it. Only that range is replaced, which is what keeps the rest of the note byte-identical.
 *
 * A slice that is **not** one of the three recognised markers returns `content` untouched. That is
 * the whole guard against a stale offset — a click racing an edit in the surface beside it must be
 * a no-op, never a corruption — so the validation happens here rather than at the call site.
 *
 * There is one unchecked spelling and two checked ones, so the flip is not symmetric: `[X]` and
 * `[x]` both become `[ ]`, and `[ ]` becomes the conventional lowercase `[x]`.
 */
export function toggleTaskAt(content: string, markerFrom: number, markerTo: number): string {
  if (markerFrom < 0 || markerTo > content.length || markerTo <= markerFrom) return content;
  const flipped = FLIPPED[content.slice(markerFrom, markerTo)];
  if (flipped === undefined) return content;
  return content.slice(0, markerFrom) + flipped + content.slice(markerTo);
}

/** Words per minute the read-time estimate divides by — fixed at 200 (spec decision 24). */
const WORDS_PER_MINUTE = 200;

/**
 * Counts a note's words by splitting on whitespace and discarding the empty tokens leading,
 * trailing and repeated whitespace produce.
 *
 * It counts the **source** rather than the rendered prose, so markdown punctuation a reader never
 * sees (`#`, `-`, `>`) rides along with the word it is attached to and a fenced code block counts
 * like any other text. That is deliberate: stripping syntax would need the *markdown walker*'s
 * tree, which would make a status-cluster readout depend on a parse, and the number is a rough
 * measure of length in either case.
 */
export function countWords(content: string): number {
  let total = 0;
  for (const token of content.split(/\s+/)) {
    if (token.length > 0) total += 1;
  }
  return total;
}

/**
 * Estimates a note's reading time in whole minutes, floored at 1 — a note short enough to round to
 * zero still takes a moment to read, and `0 min read` states something false.
 */
export function readingMinutes(content: string): number {
  return Math.max(1, Math.ceil(countWords(content) / WORDS_PER_MINUTE));
}

# Orbit token names replace the Factory vocabulary

The Factory re-skin (#56) established that a re-skin changes token *values* and never their
*names*, so downstream components stay untouched. Adopting the Orbit design system breaks that
premise: its surface ladder has five steps (`--bg-canvas` → `--bg-panel` → `--bg-surface` →
`--bg-elevated` → `--bg-hover`) against Factory's three, and its text ladder four against
three, so remapping values onto the old names would collapse distinctions the design is built
on — the editor canvas being *darker* than the sidebar panel is the core move. We therefore
adopt the Orbit names as canonical and keep the Factory names bridged in `index.css`'s `@theme`
block as temporary aliases, so components migrate slice by slice rather than in one atomic
rename.

## Considered Options

- **Values-only remap onto Factory names** (what #56 did). Cheapest, touches no component, but
  flattens 5 surfaces into 3 and 4 text levels into 3. Rejected: it buys zero-churn by
  discarding the design.
- **One atomic rename, no aliases.** Cleanest end state and no alias debt, but every
  component's `className` changes in a single slice. Rejected as an unnecessarily large blast
  radius when Tailwind v4's `@theme` can bridge both vocabularies at once for free.

## Consequences

Two token vocabularies are live simultaneously until the final slice deletes the aliases. That
slice is not optional polish — stopping short of it leaves the repo worse than either endpoint,
with new code and old code reading different names for the same color.

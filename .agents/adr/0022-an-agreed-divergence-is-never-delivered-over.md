# An agreed divergence is never delivered over

ADR-0019 opened a one-way door: a scaffold-owned file the target never touched is delivered when
the scaffold moves. The sync judged "never touched" against the baseline's agreed destination
digest alone, so a resolution that had kept project content — accepted as the agreed state on the
run after the markers were removed — counted as untouched and was overwritten on the next scaffold
change, with exit 0. This was documented ("a merged resolution does not buy permanence"), and on
2026-09-13 it cost a consumer 38 product invariants. `↻ updated` now fires only when the agreed
destination is the scaffold's own last delivery (`prev_src == prev_dest`); an **agreed divergence**
the scaffold moves against is conflict-marked again and exits non-zero, exactly like a fresh edit.

## Considered Options

- **Keep the overwrite and keep telling consumers to move content to project-owned files.**
  Rejected: that advice was already written down when the loss happened. A recorded human decision
  must not be undone silently; a human may still resolve toward the scaffold, and then it lands.
- **Three-way or row-level merge in the sync.** Rejected: POSIX `sh` with no dependencies, and the
  sync never resolves a divergence itself (ADR-0019) — merging is resolving.

## Consequences

A consumer that keeps an agreed divergence in a scaffold-owned file re-resolves it on every
upstream change to that file. That cost is visible and chosen where the overwrite was silent, and
it is the reason the resolving skill still steers project content toward a file the project owns.

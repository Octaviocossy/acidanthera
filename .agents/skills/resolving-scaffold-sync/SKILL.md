---
name: resolving-scaffold-sync
description: "Use when a scaffold sync has left conflict markers in a file — `<<<<<<< scaffold` / `=======` / `>>>>>>> project` — or a conflict sidecar (`<path>.scaffold-conflict`) beside a path that cannot hold them, such as a symlink or a directory, or when `/install-scaffold` (`.agents/scripts/install-scaffold.sh`) exits non-zero naming conflicted paths. Establishes what each side was for, resolves every marker without inventing behavior, and re-runs the sync and the scaffold's acceptance gate."
---

A **scaffold sync** brings a project's copy of the cross-agent governance scaffold up to date with
the scaffold it was installed from. Where a scaffold-owned file and the project's copy have both
moved since the last sync, the copier cannot reconcile them, so it writes the whole of each side
into the file between markers and stops:

```
  <<<<<<< scaffold
  …the version this scaffold ships…
  =======
  …the version this project has…
  >>>>>>> project
```

(The markers are indented by two spaces above so that this file is not itself reported as
conflicted — in a real conflict each marker starts at column 1.)

Where the path cannot hold that block at all — a symlink, into which writing would write through
to whatever it points at; a directory; a device node — the sync writes the same block *beside* it
instead, as `<path>.scaffold-conflict` (ADR-0020). Each side is that side's file content where the
side is a regular file, and one descriptive line otherwise (`symlink -> ../../.agents/skills/x`,
`directory`, `missing`). A **conflict sidecar** is not the thing to edit: it is a note about the
path next to it. Fix the path, then delete the sidecar.

**This is not a git merge.** There is no merge in progress, nothing to `--continue`, nothing to
`--abort`, and the target need not even be a git repository. Resolving means editing the file until
no marker remains; nothing is staged or committed unless the project is a repository *and* the user
asks for it.

## Procedure

1. **Find every conflict.** The sync named each path in its closing block and exited non-zero. If
   you do not have that output, search the tree: `grep -rl '^<<<<<<< scaffold' .` — the copier
   writes markers into scaffold-owned files only, never into project-owned ones and never into a
   file already identical to the scaffold's. A hit whose name ends in `.scaffold-conflict` is a
   sidecar: the conflict is on the path beside it.
   `find . -name '*.scaffold-conflict' -not -path './.git/*'` lists them on their own.
   A path refused for its ancestor (*beneath …, which is not a directory*) leaves no marker and no
   sidecar — the sync never read or wrote it — so only the sync's own output names it.

2. **Establish both intents before editing anything.**
   - *The scaffold side* is the version upstream ships now. Read it as a whole rather than as a
     diff, and follow what it cites — an ADR under `.agents/adr/`, a rule under `.agents/rules/`,
     an invariant in `.agents/ubiquitous-language-invariants.md`. A scaffold-owned file usually
     changed because a decision changed, and that decision is written down somewhere.
   - *The project side* is what this project did to the file. Where the target is a git
     repository, `git log -p -- <path>` says when and why; where it is not, the surrounding files
     and the project's own `AGENTS.md` are the evidence.

3. **Resolve each conflict.** Preserve both intents wherever they are compatible — an upstream
   correction and a local fill-in usually are. Where they are genuinely incompatible, prefer the
   scaffold's version: the file is one the manifest declares scaffold-owned, which is the project
   being told it is not the author. Say plainly, in your report, which project content you dropped
   and why. Never invent behavior that is in neither side, and never resolve by deleting the file.
   - For a sidecar, resolve the **path**, never the sidecar: rebuild the link the scaffold ships
     (`ln -s ../../.agents/skills/<name> .claude/skills/<name>`, after moving a materialized
     directory aside or deleting a plain file that holds the link text), or put the scaffold's file
     where a directory was in the way — then delete the sidecar. Keeping the project's version is a
     legitimate outcome, but mean it: the next sync accepts it as the agreed state, and a later
     scaffold change to that path lands over it.
   - For a path refused beneath an ancestor that is not a directory there is nothing to edit and
     nothing to delete: the sync did not read or write it. Replace the ancestor with a real
     directory — restore it from the project's history, or move what the link pointed at into
     place — or run the sync against the directory the link points at as its own target. Then
     re-run.

4. **Remove every mark.** A leftover `<<<<<<< scaffold`, `=======` or `>>>>>>> project` line is
   itself a failure: the next sync detects it and refuses to exit 0. So is a leftover sidecar.
   Check both with `grep -rn '^<<<<<<< scaffold\|^>>>>>>> project' .` and
   `find . -name '*.scaffold-conflict' -not -path './.git/*'` before moving on.

5. **Re-run the sync, then the gate.** `sh .agents/scripts/install-scaffold.sh <target>` should now
   report each of them as `↺ resolved` (or `= unchanged`, where you took the scaffold's version
   verbatim) and exit 0. A path still reported as conflicted has a marker left in it or a sidecar
   still beside it. Then run `sh .agents/scripts/verify-scaffold.sh` inside the target and fix
   whatever the resolution broke —
   a command triad split across the two sides, a skill whose frontmatter `name` no longer matches
   its directory, a manifest entry pointing at a file the resolution removed. Its exit status is
   the number of failed checks.

## What the outcome should look like

A resolution ends the matter, whichever way it went. Once no marker is left, the next sync accepts
the file as the state the two sides now agree on: it reports `↺ resolved` that once, `= unchanged`
from then on, and exits 0 either way. That holds for a merged resolution exactly as it does for one
that took the scaffold's version wholesale — a conflict you resolved correctly must not come back.
A sidecar behaves the same way: delete it once the path is fixed and the next sync reports
`↺ resolved` once, then `= unchanged`. One you forget to delete beside a path that now matches the
scaffold again is removed by the sync itself, reported as `= unchanged (stale conflict sidecar
removed)` — but one beside a path that still diverges keeps the conflict open, which is the point.

What a merged resolution does **not** buy is permanence. The file is still scaffold-owned, so the
next time the scaffold changes it upstream the new version is delivered and the project content
inside it goes with it. So where the project's content is worth keeping, move it somewhere the
project owns — `AGENTS.md`, `.agents/ubiquitous-language.md`, or its own rule file — rather than
leaving it in a file the scaffold rewrites, and say in your report that you did.

## Related

- `.agents/adr/0019-install-scaffold-syncs-instead-of-skipping.md` — why the copier stopped
  skipping, and why divergence is signalled as conflict markers rather than a sidecar diff.
- `.agents/adr/0020-unmarkable-divergence-is-marked-beside-the-path.md` — why the one class of path
  that cannot hold markers gets the same block beside it instead.
- `.agents/commands/install-scaffold.md` — the command that runs the sync, and the ownership rule
  that decides which files can conflict at all.
- `resolving-merge-conflicts` — the sibling skill, for a real git merge or rebase. Use that one
  when git is mid-merge; use this one when a sync wrote the markers.

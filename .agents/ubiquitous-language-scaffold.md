# Ubiquitous Language — Scaffold

> Vocabulary of the cross-agent harness itself — the review gate, epic orchestration, issue
> labels, the command triad.
> **Owned and updated by the scaffold.** A project must not edit this file; its own domain
> terminology belongs in `.agents/ubiquitous-language.md`.
>
> **Last updated:** 2026-09-12
> **Budget:** notes 600 · warn 16384 · fail 24576 (bytes)

---

## Glossary

### Scaffold

Vocabulary of the scaffold itself — what `/install-scaffold` installs and
`.agents/scripts/verify-scaffold.sh` enforces.

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Command triad | invariant | *wrapper pair*, *command files* | The three files a slash command must have: `.agents/commands/<name>.md` plus its `.claude/commands/` and `.opencode/commands/` wrappers. All three carry the same `<name>` and always move together. Enforced by `verify-scaffold.sh` §2. |
| Scaffold sync | process | *install*, *copy*, *scaffold update* | What `/install-scaffold` does on a re-run: creates what the target lacks and updates the scaffold-owned paths the target never edited. Project-owned paths are left alone; a scaffold-owned path the target edited is conflict-marked — in place for a regular file, beside it for a symlink or directory — and the run exits non-zero for `resolving-scaffold-sync` (ADR-0019). A path beneath an ancestor that is not a real directory is refused unread and reported as a conflict, unmarked. The sync never resolves a divergence itself. Not a git merge — the target need not be a repository. |
| Sync baseline | generated file | *lockfile*, *receipt*, *state file* | `<target>/.agents/scaffold.baseline` — what the two sides last agreed on, per path: the digest the scaffold delivered, the digest the destination had at that agreement, and whether markers are outstanding. It is the only thing that tells "the scaffold moved and the target did not" apart from "the target edited this", and a resolved conflict from a new edit — all the same observation without it. Written by every sync, committed by the target, never hand-edited. |
| Conflict sidecar | generated file (`<path>.scaffold-conflict`) | *sidecar diff*, *lock*, *stub* | The marker block a scaffold sync writes **beside** a scaffold-owned path that diverged but cannot hold text — a symlink or a directory — instead of into it: the same `<<<<<<< scaffold` / `=======` / `>>>>>>> project` shape, each side the content where that side is a regular file and one line (`symlink -> <text>`, `directory`) otherwise. Found by the same grep as an in-file conflict; deleting it once the path is fixed is the resolution signal, and the sync removes one whose path is identical to the source again. |

### Glossary governance

Vocabulary of the glossary regime itself — what `.agents/scripts/verify-scaffold.sh` §11–§12
enforce (ADR-0016, ADR-0018).

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Glossary index | generated file (`.agents/ubiquitous-language-index.md`) | *summary*, *table of contents* | The always-`@`-imported pointer table: every canonical term and its area, grouped by the file that defines it, one line each and **no definitions** — so it cannot disagree with the body it points at. Built by `build-glossary-index.sh`, verified by `verify-scaffold.sh` §11, never hand-edited (ADR-0016). |
| One-claim rule | writing rule for a definition row | *brevity rule*, *word limit* | A row states what the term **is**, its canonical type, and the one distinction that would otherwise be got wrong — nothing else. Rationale belongs to the ADR the row cites. The semantic half of the budget: a 400 B row that paraphrases its ADR still breaks it. |
| Glossary budget | `> **Budget:**` header line + `verify-scaffold.sh` §12 | *guideline*, *soft limit* | 600 B per Notes cell and per invariant bullet, fixed and universal, plus a warn/fail total cap per file declared in that file's own header. A budget, not a guideline: over the ceiling or the fail cap fails the gate, over warn only prints, and a header declaring any ceiling but 600 fails too (ADR-0018). |
| Retirement test | criterion for deleting a row | *cleanup*, *pruning* | A term is retired when removing its row would not change what anyone writes: the canonical name is the only one the code uses and no invariant cites it. The valve on the budget, applied one term at a time. *Aliases to avoid* is never evidence a row earns its place — the template asks every row for one (ADR-0018). |
| Scaffold vocabulary | the body of `.agents/ubiquitous-language-scaffold.md` | *harness terms*, *framework glossary* | Terminology describing the cross-agent harness rather than the product — the review gate, epic orchestration, issue labels, the command triad. Owned and updated by the scaffold, delivered by a scaffold sync, never merged into the project's own vocabulary in `.agents/ubiquitous-language.md` (ADR-0017). |

### Branch review

Vocabulary of `standards-and-spec-review` (`.agents/skills/standards-and-spec-review/SKILL.md`).

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Standards axis | review axis | *rules review*, *conventions review* | Asks whether the diff follows what this repo documents. `.agents/rules/*.md` is **one source** of the axis, alongside `AGENTS.md`, the glossary, and the ADRs — never the axis itself. |
| Spec axis | review axis | *issue review* | Asks whether the diff implements what was asked. Its source is whichever of issue → plan → design spec resolves first; naming it after any one of them hides the other two. |
| Fixed point | git revision | *base branch*, *target branch* | The revision a review diffs the change under review against. The comparison form follows what is under review: **committed** work three-dot against `HEAD` (`git diff <fixed-point>...HEAD`); **uncommitted** work two-dot against the **merge base** (`git diff $(git merge-base <fixed-point> HEAD)`, after `git add -N .` so untracked files enter the diff), never the fixed point directly (ADR-0009). For an epic child the fixed point is the epic integration branch, not `main`. |
| Hard violation | finding severity | *error* | A breach of an invariant the repo committed to: `.agents/ubiquitous-language-invariants.md` or an ADR. |
| Judgement call | finding severity | *warning*, *nit* | A labelled heuristic the reviewer flags for a human to weigh. Every Fowler smell in the baseline is one, without exception. |

### Review gate

Vocabulary shared by every path that reviews a change before calling it done — the two epic
execution paths and the interactive one (`/review-branch`, and `/execute-issue` Phase 3).

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Review gate | the pause itself | *code review* | The point where a change stops until a review resolves it. Under an epic it sits between a child's push and its merge into the epic branch and decides **integration**; interactively it sits between the acceptance criteria passing and the work being called done, and decides whether a **rework round** runs. It always runs an agentic review, and a human review wherever there is a human. |
| Gate line | the gate's objective summary | *verdict*, *score* | The one line a review gate prints under the two axis reports: how many **hard violations** and how many **judgement calls** were found. It is a count, never a rerank — the axes stay side by side above it. A hard violation pre-selects rework/reject with its reason loaded; a judgement call pre-selects nothing. |
| Agentic review | `standards-and-spec-review` run over a change | *automated review*, *pre-check* | The Standards + Spec pass. Its reviewer is always a **fresh context that did not write the code**, dispatched under `REVIEW_AGENT_EXEC_CMD` as **one single-axis process per axis** through `.agents/scripts/run-review-agent.sh`, each attempt capped by `REVIEW_TIMEOUT` (ADR-0012, ADR-0014). Runs on both epic paths (the runner under `--review`) and the interactive one (`/review-branch`, `/execute-issue` Phase 3). In-session sub-agents are the interactive **fallback**, announced as the weaker check. Handed paths and refs only, never the implementer's account of what it did. |
| Human review | the developer's decision at the gate | *approval*, *sign-off* | Approve or send back to rework, informed by the diff, the agent log and the agentic report. Exists on the supervised epic path (per child) and on the interactive path; `/execute-epic` is the only path that never has one. |
| Rework round | a re-execution of the implementing agent | *retry*, *fix pass* | One re-run over the rejected change, with the feedback and the agentic report as input. Under the runner it re-dispatches the child's headless agent, is counted from `rework(#N): ronda K` commits on that branch, and is capped by `MAX_REWORK_ROUNDS`. Interactively the session's own agent reworks — it already holds the implementation context — with no commits to count and no cap, since the human present ends the loop. Every round is followed by a fresh agentic review. |
| Corpus pack | review input file (`.worktrees/.corpus-pack.md`) | *cache*, *digest* | The verbatim concatenation of the standards sources (`AGENTS.md`, `.agents/rules/*.md`, the glossary's product, scaffold and invariants files — index and changelog deliberately excluded — and `.agents/adr/*.md`), built by `.agents/scripts/build-corpus-pack.sh` on **both** paths — by the runner at the start of every `--review`, and by the interactive gate before it dispatches its reviewer (ADR-0013). Handed to the **Standards axis** as its complete standards sources, **never** to the Spec one, whose sources are per-change. Lossless and per-invocation: not a summary, not durable state. |
| Review report | review output file (`.worktrees/<branch>.review.md`, with `/` in the branch name sanitized to `-`) | *review state*, *verdict file* | Where a gate's aggregated Standards + Spec report is persisted. Written by whoever drives the gate — the runner under `--review`, the command on the interactive path — never by the skill, which stays read-only. An **artifact**, never state: nothing reads it back to decide what stage a change is at. The runner **overwrites** it each round; the interactive path **appends** a `## Round N` section (ADR-0011). |

### Parallel orchestration

Vocabulary exclusive to the two epic execution paths (`.agents/rules/parallel-orchestration.md`,
`.agents/scripts/run-parallel-issues.sh`). The gate vocabulary they share with the interactive
path is in the Review gate area above.

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Auto execution | execution path (`/execute-epic`) | *vibecode mode* | Runs end to end with no prompt. A child is integrated only after passing the agentic review; a hard violation blocks it and triggers rework instead. The default. |
| Supervised execution | execution path (`/supervise-epic`) | *review mode*, *integration mode* | The same pipeline plus a human decision per child, taken on the diff, the log and the agentic report. User-invocable only — there must be somebody answering. |

### Issue labels

Vocabulary of the labels the issue-creating commands attach to a GitHub issue.

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Issue label | GitHub label on an issue | *tag* | The metadata `/create-issue` and `/spec-breakdown` attach to an issue so it is recognisable and filterable in the GitHub UI. **Always "label", never "tag"** — GitHub's own term, the term the four commands that still refuse to touch this metadata already use (`/ship-note`, `/comment-issue`, `/execute-issue`, `/handoff`), and *tag* is already taken in this repo for a **git tag** (a fixed point, see Branch review). |
| Label taxonomy | `.agents/labels.md` | *label config*, *label list* | The versioned declaration of which labels this project uses: every closed facet's complete value set, plus the naming convention for the open one. Shipped by the scaffold, personalised per project. |
| Closed facet | label namespace with a fixed value set | *label group*, *category* | A `<facet>:<value>` namespace whose values are enumerated in the taxonomy; the agent may only pick from them. `type:` is the one the scaffold ships (`feat`, `fix`, `chore`, `docs`, `refactor`, `test` — the Conventional Commits prefixes `/create-issue` already requires in the title — plus `epic`, see Epic label below). |
| Open facet | label namespace whose values the agent derives | *free label*, *dynamic label* | A `<facet>:<value>` namespace the taxonomy declares but does not enumerate, because its values are project-specific and the scaffold is stack-neutral. `area:` is the one the scaffold ships, derived from the issue's `## Affected Files`. The command **reuses an existing value before inventing one** (it lists the repo's labels first), and creates the label itself when the value is genuinely new — otherwise there would never be a first one to reuse. |
| Epic label | `type:epic` | *`epic`*, *epic marker* | The closed-facet value that marks an epic issue, so an epic is filterable in the GitHub UI rather than only recognisable by its `epic: ` title prefix. It is a `<facet>:<value>` like every other label the scaffold emits — there is no bare-word exception. |

---

## Flagged ambiguities

_None documented yet._

# Ubiquitous Language — Scaffold

> Vocabulary of the cross-agent governance scaffold: the review gate, epic orchestration,
> issue labels, the command triad. Arrives via `/install-scaffold` and is owned upstream,
> so an upstream update never merges into product vocabulary (decision 3).
>
> **Last updated:** 2026-09-11
>
> Invariant numbering continues the product file: **1–38** live in
> `.agents/ubiquitous-language-invariants.md`, **39–56** here.
>
> Every Notes cell and every invariant is capped at **600 bytes** —
> `.agents/scripts/verify-scaffold.sh` §11 enforces it (ADR 0043).

---

## Scaffold

Vocabulary of the cross-agent governance scaffold itself — what `/install-scaffold` installs and
`.agents/scripts/verify-scaffold.sh` enforces.

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Command triad | invariant | *wrapper pair*, *command files* | The three files a slash command must have: `.agents/commands/<name>.md` plus its `.claude/commands/` and `.opencode/commands/` wrappers. All three carry the same `<name>` and always move together. Enforced by `verify-scaffold.sh` §2. |
| Glossary index | `.agents/ubiquitous-language-index.md`, built by `.agents/scripts/build-glossary-index.sh` | summary, digest, TOC | The generated, always-`@`-imported table mapping every canonical term to the area that defines it, one line each. A **pointer table, never a summary**: it carries no definition, so it cannot disagree with the body (ADR 0041). Never hand-edited — `verify-scaffold.sh` §11 regenerates it to a temp file and fails on any diff, which is ADR 0024's rebuild-every-time discipline adapted to a file that has to persist because `@` imports a path and cannot run a script. |
| One-claim rule | editorial rule on a glossary Notes cell | *style guide*, *brevity* | A glossary row states what the term **is**, its canonical type, and the one distinction that would otherwise be got wrong. Rationale belongs to the ADR the row cites, never restated beside the citation. The **semantic** half of the *glossary budget*; the 600 B ceiling is the mechanical half, and neither works alone — a row can be under the ceiling and still restate its own ADR. When a row cannot fit without losing a distinction, that distinction moves **into** the ADR; a row with no ADR to move it to is a row carrying a decision that should be one. |
| Glossary budget | `verify-scaffold.sh` §11 (ADR 0043) | *guideline*, *soft limit* | 600 B per Notes cell and per invariant, warn at 80,000 B and fail at 100,000 B on `.agents/ubiquitous-language.md`. A **budget rather than a guideline**: exceeding it fails the scaffold gate, which is what forces a *retirement test* instead of silent growth. Mechanical because prose was already tried here — the 2026-07-22 cleanup wrote anti-append rules and the file grew roughly sixfold afterwards. The ceiling targets the tail, not the average: the median cell was 293 B and correct. |
| Retirement test | the decision the *glossary budget*'s cap forces | *pruning*, *cleanup* | A term is retired when removing its row **would not change what anyone writes** — the canonical name is the only name the code uses, and no invariant cites the term. *Aliases to avoid* is explicitly **not** evidence of live ambiguity: 143 of 145 rows carried one because the table template asks for one, and a test that trusted that column fired on 2 rows out of 145. It is the **valve the cap opens**, not routine pruning: it runs when the file hits its budget, so hitting the cap forces a real decision about what the glossary is for. |
| Scaffold vocabulary | `.agents/ubiquitous-language-scaffold.md` | *meta vocabulary*, *tooling terms* | Terminology describing the cross-agent harness rather than the product — the review gate, epic orchestration, issue labels, the command triad — plus invariants **39–56**. Arrives via `/install-scaffold` and is **separately owned**, so an upstream update never merges into product vocabulary. Two owners editing one file had already produced a duplicate ADR number (`0034` exists twice). Its invariant numbers continue the product file's rather than restarting: the body, both SKILLs and several ADRs cite invariants by number. |

---

## Branch review

Vocabulary of `standards-and-spec-review` (`.agents/skills/standards-and-spec-review/SKILL.md`).

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Standards axis | review axis | *rules review*, *conventions review* | Asks whether the diff follows what this repo documents. `.agents/rules/*.md` is **one source** of the axis, alongside `AGENTS.md`, the glossary, and the ADRs — never the axis itself. |
| Spec axis | review axis | *issue review* | Asks whether the diff implements what was asked. Its source is whichever of issue → plan → design spec resolves first; naming it after any one of them hides the other two. |
| Fixed point | git revision | *base branch*, *target branch* | The revision a review diffs the change under review against. The form follows what is under review: three-dot against `HEAD` (`git diff <fixed-point>...HEAD`) for committed work, two-dot against the **merge base** (`git diff $(git merge-base <fixed-point> HEAD)`, after `git add -N .` so untracked files enter) for uncommitted work. Against the merge base and never the fixed point directly, or commits it gained since the branch was cut show up as reversed. The interactive path reviews uncommitted work by default. For an epic child the fixed point is the epic integration branch, not `main`. |
| Hard violation | finding severity | *error* | A breach of something the repo committed to: a definition in `.agents/ubiquitous-language.md` **or in this file**, an invariant (**1–38** in `.agents/ubiquitous-language-invariants.md`, **39–56** here), or an ADR. Every file is named because the invariants used to live inside the vocabulary file, and a rule still naming only that file would silently stop treating an invariant breach as hard. Scaffold vocabulary counts the same as product vocabulary — `standards-and-spec-review` Step 3 binds the whole family. Contrast *judgement call*. |
| Judgement call | finding severity | *warning*, *nit* | A labelled heuristic the reviewer flags for a human to weigh. Every Fowler smell in the baseline is one, without exception. |

---

## Review gate

Vocabulary shared by every path that reviews a change before calling it done — the two epic
execution paths and the interactive one (`/review-branch`, and `/execute-issue` Phase 3).

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Review gate | the pause itself | *code review* | The point where a change stops until a review resolves it. Under an epic it sits between a child's push and its merge into the epic branch and decides **integration**; interactively it sits between the acceptance criteria passing and the work being called done, and decides whether a **rework round** runs. It always runs an agentic review, and a human review wherever there is a human. |
| Gate line | the gate's objective summary | *verdict*, *score* | The one line a review gate prints under the two axis reports: how many **hard violations** and how many **judgement calls** were found. It is a count, never a rerank — the axes stay side by side above it. A hard violation pre-selects rework/reject with its reason loaded; a judgement call pre-selects nothing. |
| Agentic review | `standards-and-spec-review` run over a change | *automated review*, *pre-check* | The Standards + Spec pass. Runs on **both** epic execution paths (the runner fans it out under `--review`, writing `.worktrees/<branch>.review.md`) and on the interactive path. Its reviewer is always a **fresh context that did not write the code**, dispatched under `REVIEW_AGENT_EXEC_CMD` as **one single-axis process per axis** through `run-review-agent.sh`, each attempt capped by `REVIEW_TIMEOUT` (ADR 0028, ADR 0030). The model may deliberately differ from the implementer's. Fresh in-session sub-agents are the interactive **fallback**, announced as weaker. It is handed paths and refs only. |
| Human review | the developer's decision at the gate | *approval*, *sign-off* | Approve or send back to rework, informed by the diff, the agent log and the agentic report. Exists on the supervised epic path (per child) and on the interactive path; `/execute-epic` is the only path that never has one. |
| Rework round | a re-execution of the implementing agent | *retry*, *fix pass* | One re-run over the rejected change, with the feedback and the agentic report as input. Under the runner it re-dispatches the child's headless agent, is counted from `rework(#N): ronda K` commits on that branch, and is capped by `MAX_REWORK_ROUNDS`. Interactively the session's own agent reworks — it already holds the implementation context — with no commits to count and no cap, since the human present ends the loop. Every round is followed by a fresh agentic review. |
| Corpus pack | review input file (`.worktrees/.corpus-pack.md`) | *cache*, *digest* | The verbatim concatenation of the standards sources (`AGENTS.md`, `.agents/rules/*.md`, the glossary, `.agents/adr/*.md`), built by `.agents/scripts/build-corpus-pack.sh` on **both** paths — by the runner at the start of every `--review`, and by the interactive gate before it dispatches its reviewer (ADR 0029). Handed to the **Standards axis** as its complete standards sources, **never** to the Spec one, whose sources are per-change. Lossless and per-invocation: not a summary, not durable state. |
| Review report | review output file (`.worktrees/<branch>.review.md`, with `/` in the branch name sanitized to `-`) | *review state*, *verdict file* | Where a gate's aggregated Standards + Spec report is persisted. Written by whoever drives the gate, the runner under `--review` or the command on the interactive path, never by the skill, which stays read-only. It is an **artifact, never state**: nothing reads it back to decide what stage a change is at. The runner **overwrites** it each round, the history there already living in git; the interactive path **appends** a `## Round N` section, there being no commits and the file being the only place a prior round survives. |

---

## Parallel orchestration

Vocabulary exclusive to the two epic execution paths (`.agents/rules/parallel-orchestration.md`,
`.agents/scripts/run-parallel-issues.sh`). The gate vocabulary they share with the interactive
path is in the Review gate area above.

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Auto execution | execution path (`/execute-epic`) | *vibecode mode* | Runs end to end with no prompt. A child is integrated only after passing the agentic review; a hard violation blocks it and triggers rework instead. The default. |
| Supervised execution | execution path (`/supervise-epic`) | *review mode*, *integration mode* | The same pipeline plus a human decision per child, taken on the diff, the log and the agentic report. User-invocable only — there must be somebody answering. |

---

## Issue labels

Vocabulary of the labels the issue-creating commands attach to a GitHub issue.

| Term | Canonical type | Aliases to avoid | Notes |
|------|----------------|------------------|-------|
| Issue label | GitHub label on an issue | *tag* | The metadata `/create-issue` and `/spec-breakdown` attach to an issue so it is recognisable and filterable in the GitHub UI. **Always "label", never "tag"** — GitHub's own term, the term the four commands that still refuse to touch this metadata already use (`/ship-note`, `/comment-issue`, `/execute-issue`, `/handoff`), and *tag* is already taken in this repo for a **git tag** (a fixed point, see Branch review). |
| Label taxonomy | `.agents/labels.md` | *label config*, *label list* | The versioned declaration of which labels this project uses: every closed facet's complete value set, plus the naming convention for the open one. Shipped by the scaffold, personalised per project. |
| Closed facet | label namespace with a fixed value set | *label group*, *category* | A `<facet>:<value>` namespace whose values are enumerated in the taxonomy; the agent may only pick from them. `type:` is the one the scaffold ships (`feat`, `fix`, `chore`, `docs`, `refactor`, `test` — the Conventional Commits prefixes `/create-issue` already requires in the title — plus `epic`, see Epic label below). |
| Open facet | label namespace whose values the agent derives | *free label*, *dynamic label* | A `<facet>:<value>` namespace the taxonomy declares but does not enumerate, because its values are project-specific and the scaffold is stack-neutral. `area:` is the one the scaffold ships, derived from the issue's `## Affected Files`. The command **reuses an existing value before inventing one** (it lists the repo's labels first), and creates the label itself when the value is genuinely new — otherwise there would never be a first one to reuse. |
| Epic label | `type:epic` | *`epic`*, *epic marker* | The closed-facet value that marks an epic issue, so an epic is filterable in the GitHub UI rather than only recognisable by its `epic: ` title prefix. It is a `<facet>:<value>` like every other label the scaffold emits — there is no bare-word exception. |

---

## Invariants (scaffold)

39. **A command triad moves as a unit.** Renaming, adding, or deleting a slash command touches all three of its files in the same change; a partial triad fails the acceptance gate.
40. **A review finding is a hard violation only if it breaches the glossary or an ADR.** Everything the Fowler smell baseline surfaces is a judgement call, no matter how confident the reviewer is. A documented repo standard overrides the baseline where the two disagree.
41. **The Standards axis and the Spec axis are never merged or reranked against each other.** A change can pass one and fail the other; combining them lets the passing axis mask the failing one.
42. **Axis isolation is blindness between findings, never exclusivity over sources.** The Standards and Spec sub-agents may be handed the same pre-read source material; what they must never see is each other's findings or a merged ranking of them.
43. **The runner is the sole writer of the epic integration branch, on both execution paths** (ADR 0020). A review gate changes *when* a child is merged, never *who* merges it — the agent only reads epic branch state and opens the final PR.
44. **Review state is derived from git, never stored** (ADR 0021). A child awaits review if its remote branch exists and the epic branch carries no `Merge child #N` for it; rework rounds are counted from commit markers. There is no durable state file to disagree with the repository.
45. **Every child passes an agentic review before it can be integrated, on both execution paths.** What differs is who resolves a finding: on the supervised path a hard violation pre-selects rejection and the human decides; on the auto path it blocks integration and triggers rework directly. Never whether the review runs.
46. **Both execution paths run one pipeline** (ADR 0023). Run → review → optional rework → integrate. No path has a shortcut that merges without review — that is what removing the inline merge bought.
47. **A rejection triggers rework; a merge conflict does not.** A conflict is an integration problem and goes to guided recovery in the child's direction; rework is for "this is not what I asked for."
48. **The shape of a session is chosen at the call site, never in `.agents/parallel.config`** (ADR 0022). That file is gitignored and per-machine, so it may hold operational knobs (concurrency, timeouts, caps) but nothing that decides whether a human is required.
49. **A review gate never emits a merged verdict.** It presents both axes side by side and one objective *gate line* counting hard violations and judgement calls. Counting is not reranking; the moment a gate collapses the two axes into a single approve/reject, the passing axis starts masking the failing one (extends invariant 41).
50. **Work is not done until an agentic review has seen it.** Under an epic that means before integration; interactively it means after the acceptance criteria pass and before `/execute-issue` reports completion. What varies across paths is who resolves a finding, never whether the review runs — with exactly one declared exception: `skip review` on the interactive path, which a human chooses at the call site and which must be stated in the final report. No path may skip the review by omission, by configuration, or silently (generalizes invariant 45).
51. **A review report is an artifact, never review state.** Persisting one does not contradict invariant 44: nothing reads a report back to decide what stage a change is at. The moment something did, the file could disagree with the repository — which is the failure ADR 0021 exists to prevent.
52. **Every source a reviewer needs arrives by path, already materialized.** The corpus pack, the issue body, the plan, the design spec and the diff are all written to disk *before* the review prompt is built, on both paths. A reviewer sent to *find* a source has an unbounded search space, and the observed failure is not that it costs more but that it reads less and reports shallowly — or never returns. A wall-clock cap (`REVIEW_TIMEOUT` per reviewer attempt, `AGENT_TIMEOUT` per implementing agent) exists to catch that, never to make it tolerable.
53. **An issue label is informational; nothing in the pipeline reads one back** (ADR 0031). Neither execution path, the runner, nor the review gate branches on a label. The moment one did, GitHub would become a source of execution state that can disagree with the repository — which is exactly what invariant 44 exists to prevent.
54. **Labels are written at creation and corrected only by `/update-issue`.** `/create-issue` and `/spec-breakdown` set them; `/update-issue` may fix them, because correcting an inaccurate generation is what that command is for. `/ship-note`, `/comment-issue`, `/execute-issue` and `/handoff` still never send labels.
55. **Applying a label is best-effort and never blocks issue creation.** A decorative metadatum must not be able to stop the issue from existing — and GitHub already behaves this way, silently dropping labels from a token without push access rather than failing the request.
56. **A child never inherits its epic's labels.** Every issue is labelled from its own content; propagating the epic's labels down would give every child the same set and destroy the filter's value. The `> Epic: #<n>` body header is what groups them.

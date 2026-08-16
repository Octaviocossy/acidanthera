---
name: standards-and-spec-review
description: "Use when you want to verify that a branch both follows this repository's documented standards (AGENTS.md, .agents/rules/, the ubiquitous language, ADRs) and faithfully implements the issue, plan, or spec it came from. Runs the two axes as parallel sub-agents and reports them side by side without merging them. Not a correctness-bug hunt — that is /code-review."
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.

Issues are reached through the **GitHub MCP server** registered in `.mcp.json` / `opencode.json`; branch → issue resolution follows `.agents/rules/issue-resolution.md`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here — not inside two parallel sub-agents.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, GitLab `!67`, etc.) — fetch via the workflow in `docs/agents/issue-tracker.md`.
2. A path the user passed as an argument.
3. A spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Identify the standards sources

Anything in the repo that documents how code should be written, such as `CODING_STANDARDS.md` or `CONTRIBUTING.md`.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below — a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation — and, like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Spawn both sub-agents in parallel

**Standards sub-agent prompt** — include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the smell baseline from step 3** pasted in full — the sub-agent has no other access to it.
- The brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** — include:

- The diff command and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings — the two axes are deliberately separate (see _Why two axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes — that's the reranking the separation exists to prevent.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.

## In this repository

Grounding for the steps above. Everything else is unchanged.

**Step 1 — deduce the fixed point before asking.** This repo's branch model makes it derivable, so
propose one and show it rather than opening with a question:

- Branch matches `<issue#>-<kebab-title>` and an `epic/*` branch contains it → that epic
  integration branch is the fixed point. Children are cut from the epic branch, never from `main`
  (`.agents/rules/parallel-orchestration.md`), so diffing against `main` would drag in every
  already-integrated sibling's work.
- Otherwise → `main`.

State the fixed point you picked so the user can correct it. Only ask when the deduction fails.

**The comparison form follows what is under review.** Upstream step 1 hardcodes three-dot; here
it depends on whether the work is committed:

- **Committed** (every epic child — the runner commits and pushes before reviewing):
  `git diff <fixed-point>...HEAD`.
- **Uncommitted** (the interactive gate — `/execute-issue` never commits, ADR-0025):
  `git diff $(git merge-base <fixed-point> HEAD)`, after `git add -N .` so untracked files enter
  the diff. Diff against the **merge base**, not against the fixed point directly: a plain
  `git diff <fixed-point>` would render everything the fixed point gained since the branch was
  cut as spurious reversed changes. This is the working-tree analogue of the three-dot form, and
  it is a superset of it — it sees committed and uncommitted work alike.

When the invoker names the form, use it — the runner always does. Otherwise pick the merge-base
form, which is correct whether or not anything is committed, and **say which you picked**. Never
decide from a fixed default: on uncommitted work three-dot yields an empty diff and trips the
guard below, reporting "nothing to review" about a branch full of changes.

**Step 2 — spec sources, in this order.** This replaces the upstream search order; `docs/`,
`specs/`, and `.scratch/` do not exist here.

1. **The branch's issue.** Resolve branch → issue by `.agents/rules/issue-resolution.md` (leading
   numeric segment → linked PR → title-slug → ask), then read it with `mcp__github__issue_read`
   (`method: "get"`).
2. **The linked plan.** A `.agents/plans/*.md` whose header carries that issue in `> Issue: #N`.
   The plan states the intent better than the diff or the issue body does.
3. **The design spec.** A `.agents/specs/*.md` referenced by that plan or issue — the settled
   decisions from `/grill`, including its **Explicitly Out of Scope** section, which is the
   sharpest scope-creep detector available.
4. **A path the user passed** as an argument.
5. **Ask** — and if there is no spec, the Spec sub-agent skips and reports "no spec available".

For an epic child, also read the epic issue named by `> Epic: #<n>`: it scopes what this child was
supposed to own. `> Depends on: #…` names the siblings whose work is *legitimately* visible in the
diff base and must not be reported as scope creep.

**Step 3 — standards sources.** There is no `CODING_STANDARDS.md` or `CONTRIBUTING.md` here. Use:

- `AGENTS.md` — `## Commands`, `## Testing`, `## Verification Quirks`, `## Code Structure`,
  `## Workspace`. Entries still reading `_not yet documented_` document nothing; do not invent a
  standard from them.
- `.agents/rules/*.md` — the enforceable conventions (plan creation, testing, command creation,
  skill creation, parallel orchestration, issue resolution, ADRs, the glossary rule).
- `.agents/ubiquitous-language.md` — canonical terms, aliases to avoid, and invariants.
- `.agents/adr/*.md` — decisions the code must not silently reverse.

**Step 3 — one local override to the baseline.** The twelve Fowler smells stay judgement calls,
exactly as upstream binds them. But a breach of `.agents/ubiquitous-language.md` or of an ADR is a
**hard violation**, not a judgement call: those are invariants the repo committed to, not
heuristics. Say which kind each finding is.

**Step 4 — how to spawn the two sub-agents.** Invoking this skill is the user's authorization to
dispatch sub-agents.

- **Claude Code** — the Agent tool with `subagent_type: general-purpose` (it needs git and broad
  read access). Issue **both calls in a single message** so they actually run concurrently.
- **OpenCode** — its native sub-agent mechanism.

Running the two axes sequentially in the main context defeats the design: once you have read the
smell baseline, you cannot look at the diff without it.

**Step 4 — single-axis invocation.** Neither external review path invokes this skill once and
lets it fork: the interactive gate and the runner's `--review` action both dispatch **one
reviewer process per axis** (ADR-0030), so each process executes this skill for *its own axis
only*. When the invoker names an axis:

- Run steps 1–3 for that axis alone, then produce that axis's report directly. **Do not dispatch
  sub-agents** — you *are* the sub-agent — and do not report on the other axis; a second process
  is already doing it, and duplicating its work is how a review reruns the same reading twice.
- The report is your entire final message: no preamble, no aggregation, no gate line. Whoever
  dispatched you owns step 5 — the session interactively, the runner headless.
- Everything else here is unchanged — the smell baseline still binds the Standards axis, and the
  hard-violation vs judgement-call split still applies.

This is the *same* division of labour as the sub-agent fan-out; only the process boundary moved
outward. Axis isolation is unaffected, and in fact strengthened: two processes cannot see each
other's findings at all. The in-session sub-agent fan-out above remains for a whole-skill
invocation in a session — the interactive fallback, or the skill invoked directly.

**Headless runs are allowed, and must never block.** Unlike `/grill`, this skill may run inside a
child of `.agents/scripts/run-parallel-issues.sh` — a child checking its own diff against its own
issue before the runner integrates it into the epic branch is the highest-value use of this skill.
There is no human there, so: if the fixed point cannot be deduced, report that and continue against
`main`; if no spec is found, report "no spec available" and run the Standards axis alone. Never
stop to ask.

**Corpus pack — pre-read inputs on both review paths.** When the invoker names a
**corpus pack** (`.worktrees/.corpus-pack.md`, rebuilt by `.agents/scripts/build-corpus-pack.sh`
on every `--review` invocation and before every interactive dispatch, ADR-0029 — the verbatim,
path-separated concatenation of `AGENTS.md`,
`.agents/rules/*.md`, `.agents/ubiquitous-language.md`, and `.agents/adr/*.md`), skip the
source reading in steps 2–3 entirely: verify the named files exist, hand the pack to the
**Standards** sub-agent as its complete standards sources, and hand the **Spec**
sub-agent its per-change sources (`.worktrees/<branch>.issue.md`, the linked plan, and
`.worktrees/.epic-issue.md` when named) — all by path, reading none of them yourself.
Never give the pack to the Spec sub-agent: each axis gets only its own sources. Axis
isolation is blindness between findings, never exclusivity over sources
(`.agents/ubiquitous-language.md`; ADR-0024). The smell baseline still travels as
always — pasted into the Standards prompt from this file. Without a pack — an invocation
that names none — nothing changes: read the sources as steps 2–3 describe.

The paragraph above describes the **orchestrating** role, which hands sources onward without
reading them. Under a **single-axis invocation** you hold no such role: the pack named to a
Standards process is *your own* complete standards sources, and you read it. The rule that never
bends either way is which axis may see it — the pack goes to Standards, never to Spec.

**Step 5 — the report goes to the chat only.** This skill reads; it does not write files, commit,
or touch GitHub. To put a report on the branch's issue, hand off to `/comment-issue`.

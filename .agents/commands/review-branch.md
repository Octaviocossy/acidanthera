# Command: review-branch

Review the current branch's work on two axes — **Standards** (does it follow what this repo
documents?) and **Spec** (does it implement what was asked?) — present both side by side under
an objective **gate line**, then loop **rework rounds** until you approve. This is the canonical
interactive review gate: `/execute-issue` Phase 3 invokes this same procedure rather than
duplicating it (ADR-0026).

The work under review does **not** have to be committed. `/execute-issue` never commits, so by
default this command diffs the **working tree** against the fixed point — see ADR-0025.

`$ARGUMENTS` is **optional**: a fixed point (branch, SHA, `main`) and/or the literal token
`committed-only`.

This command reads, reviews, and reworks the working tree. It never commits, never pushes, and
never **writes** to GitHub — it does *read* the branch's issue, which the Spec axis needs. To
put a report on the branch's issue, run `/comment-issue`; to record an outcome, `/ship-note`.

## User-invocable only

This command must never run inside a headless parallel-runner child
(`.agents/scripts/run-parallel-issues.sh`). Its gate ends in a human decision: with nobody
there the run either hangs waiting or the agent approves its own work — exactly the
independence the gate exists to enforce. Headless review already has its own path, the runner's
`--review` action, which resolves findings by the objective hard-violation rule instead of
asking. This is the same boundary `design-interrogation.md` draws around `/grill` and
`supervise-epic.md` draws around itself.

| Agent | Enforcement |
|-------|-------------|
| Claude Code | `disable-model-invocation: true` in `.claude/commands/review-branch.md` — user-invoked only |
| OpenCode | No equivalent frontmatter field; this paragraph is the enforcement — never dispatch `/review-branch` from inside a headless run |

## Context injected by the wrapper

- **Repository remote URL** — parse `owner`/`repo` from the injected `git remote get-url origin`
  output (HTTPS or SSH). The Spec axis needs it to resolve branch → issue.
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

---

## Instructions

### 1 — Resolve the fixed point

- If `$ARGUMENTS` holds a token other than `committed-only` and `git rev-parse --verify <token>`
  succeeds, that token is the fixed point.
- Otherwise deduce it, per the `standards-and-spec-review` grounding (Step 1): if the branch
  matches `<issue#>-<kebab-title>` and an `epic/*` branch contains it
  (`git branch --contains HEAD --list 'epic/*'`), that epic integration branch is the fixed
  point — children are cut from the epic branch, so diffing against `main` would drag in every
  already-integrated sibling. Otherwise `main`.
- **Always print the fixed point you picked**, so the user can correct it before anything
  expensive runs.

### 2 — Build the diff

The comparison form follows what is under review (ADR-0025).

**Default — the working tree.** Give untracked files intent-to-add so they enter the diff, then
diff two-dot:

```sh
git add -N .
git diff $(git merge-base <fixed-point> HEAD)
```

Two details that are easy to get wrong:

- Diff against the **merge base**, not against the fixed point directly. A plain
  `git diff <fixed-point>` renders everything the fixed point gained since this branch was cut
  as spurious *reversed* changes — the exact problem three-dot exists to solve, which the
  working-tree form has to solve too.
- Run `git add -N .` from the repository root. It honors `.gitignore`, and staying a single
  `git`-prefixed command keeps it inside the wrapper's `Bash(git:*)` pre-approval instead of
  prompting on every invocation.

This covers everything since the fixed point, committed or not — which on the interactive path
is usually *nothing* committed at all.

**With `committed-only`.** Use the three-dot form and skip the intent-to-add entirely:

```sh
git diff <fixed-point>...HEAD
```

Also capture the commit list, `git log <fixed-point>..HEAD --oneline`. It may be empty on the
interactive path; that is expected, not an error.

**Guard:** if the diff is empty, stop and say so. Do not spawn sub-agents against nothing.

The intent-to-add is the **only** index mutation this command makes. It stages no content, and
it is deliberately left in place so the user's `git status` and a later `/ship-note` see a
consistent picture. Do not "clean it up" with a `git reset` — that would unstage whatever the
user had staged on purpose.

### 3 — Run the agentic review

**Dispatch the reviewer under `REVIEW_AGENT_EXEC_CMD`**, not in this session:

```sh
sh .agents/scripts/run-review-agent.sh "<review prompt>"
```

The script sources `.agents/parallel.config`, resolves `REVIEW_AGENT_EXEC_CMD` (falling back to
`AGENT_EXEC_CMD` when empty — never to "skip the review"), and appends the prompt as the final
positional argument. Its stdout **is** the report.

This is the same contract the runner's `--review` action uses, and for the same reason: **you
wrote this code**. A reviewer running on your model inherits your blind spots, so the config
deliberately allows the reviewer to be a different model than the implementer (ADR-0028). An
in-session sub-agent gets a fresh *context* but not a fresh *model*, which is the weaker half
of the guarantee.

Build the prompt from **paths and refs only** — never your own account of what you just
implemented. That summary is precisely the contamination a fresh reviewer exists to avoid. The
prompt must carry:

- the fixed point from step 1 and the **exact** diff command from step 2, so the reviewer does
  not re-derive the comparison form and silently fall back to three-dot;
- the instruction to run the `standards-and-spec-review` process
  (`.agents/skills/standards-and-spec-review/SKILL.md`) and dispatch its two axes as its own
  sub-agents;
- the spec sources by path: the branch's issue, the linked `.agents/plans/` file if one exists,
  and any `.agents/specs/` file they reference. The reviewer has **no GitHub access** — if the
  Spec axis needs the issue body, fetch it yourself first with
  `gh issue view <n> --repo <owner>/<repo> --json body -q .body` and pass the resulting file's
  path. Do not use `mcp__github__issue_read` for this: it returns the body HTML-sanitized and
  deletes every `<...>` placeholder, which silently corrupts paths and git commands in the very
  document the Spec axis reviews against;
- the instruction that its entire final message is the report, saved verbatim.

**Build the corpus pack first** and name it in the prompt (ADR-0029):

```sh
sh .agents/scripts/build-corpus-pack.sh .worktrees/.corpus-pack.md
```

An external reviewer pulls every standards source through its own tool calls, and the observed
failure mode is not that it costs more but that it reads *less* and reports shallowly. Hand the
pack to the **Standards** sub-agent as its complete standards sources — **never** to the Spec
one, whose sources are per-change. Axis isolation is blindness between findings, never
exclusivity over sources (ADR-0024).

**Fallback.** If the script exits `3` (no `.agents/parallel.config`, or no command configured)
or `4` (the configured CLI is not on PATH), say so plainly and run the two axes as fresh
in-session sub-agents instead, handed the same paths and refs. Degrading to a same-model
reviewer is worse than an external one and must be stated; skipping the review is not an
option — *work is not done until an agentic review has seen it*
(`.agents/ubiquitous-language.md` › invariants).

### 4 — Present the gate

- Print the two axis reports under `## Standards` and `## Spec`, verbatim, side by side.
  **Never merge or rerank them** — a change can pass one and fail the other, and combining them
  lets the passing axis mask the failing one (`.agents/ubiquitous-language.md` › invariants).
- Below them print the **gate line**, exactly one line:

  ```
  **Gate:** N hard violation(s), M judgement call(s).
  ```

  A count is not a rerank. There is no combined verdict, by design.
- If `N > 0`, **pre-select rework** and list each hard violation's reason. A **judgement call**
  pre-selects nothing — you weigh it yourself. (Severity definitions:
  `.agents/ubiquitous-language.md` › Branch review.)
- Ask for an explicit **approve** or **rework**. On rework, ask for written feedback; it may be
  left blank, in which case the aggregated report alone is the feedback.

### 5 — Rework loop

- **You** do the rework — the session's own agent already holds the implementation context,
  the same way the runner re-dispatches the child's own agent rather than a stranger.
- Input: the user's written feedback (if any) plus the full aggregated report.
- Working tree only. No commits, no pushes, no GitHub writes.
- After each rework round, **return to step 3 with fresh sub-agents** and re-present the gate.
  A rework can break something the previous round passed; skipping the re-review is how that
  regression survives.
- There is **no round cap**. `MAX_REWORK_ROUNDS` exists because the auto path has nobody to stop
  it; here there is a human, and they end the loop by approving or by walking away.

### 6 — Write the review report

- **Path:** `.worktrees/<branch>.review.md`, with `/` replaced by `-` in the branch name
  (`epic/55-foo` → `.worktrees/epic-55-foo.review.md`). Create `.worktrees/` if it does not
  exist — a clone where the runner has never run will not have it. The directory is already
  gitignored.
- **This command writes the file**, not the skill. The skill stays read-only, exactly as under
  the runner, where the runner captures the reviewer's stdout and the skill writes nothing.
- **Append** one `## Round N` section per review pass, N starting at **1** for the initial
  review (ADR-0027). Never overwrite: without commits, this file is the only place a prior
  round survives, and seeing what the code looked like before a rework is the whole point. The
  **last** section is the current one.
- Write each section *after* the user decides, so the decision travels with the findings that
  produced it:

  ```markdown
  ## Round N

  **Gate:** N hard violation(s), M judgement call(s).

  ### Standards
  <the Standards report, verbatim>

  ### Spec
  <the Spec report, verbatim>

  **Decision:** approve | rework — <written feedback, or "no written feedback">
  ```
- On the first write, precede the sections with a header carrying the branch, the fixed point,
  and which comparison form was used:

  ```markdown
  # Review report — <branch>

  > Fixed point: `<fixed-point>`
  > Comparison: working tree (`git diff $(git merge-base <fixed-point> HEAD)`) | committed only (`git diff <fixed-point>...HEAD`)
  > Reviewer: `<the REVIEW_AGENT_EXEC_CMD used, or "in-session sub-agents (fallback)">`
  ```

### 7 — Close out

Report the path of the review report and the final decision. If the branch has an issue and the
user wants the report on it, point them at `/comment-issue`; after an approved review of an
`/execute-issue` run, point them at `/ship-note`.

---

## Rules

- **The two axes are never merged or reranked.** The gate line is a count, never a verdict.
- **A hard violation pre-selects rework; a judgement call never does.** Either way the human
  decision is final — the report informs it, it never substitutes for it.
- **The reviewer is always a fresh context that did not write the code**, handed paths and refs
  only. Never pass the implementer's own account of its work to a reviewing sub-agent.
- **The comparison form follows what is under review** — working tree by default, three-dot
  under `committed-only`. Never review an empty diff.
- **Working tree only:** never commit, push, or **write** to GitHub; reading the branch's issue
  is expected. The intent-to-add in step 2 is the single index mutation, and it stages no
  content.
- **The reviewer runs under `REVIEW_AGENT_EXEC_CMD`**, dispatched through
  `.agents/scripts/run-review-agent.sh` — a different model from the implementer's whenever the
  config says so (ADR-0028). In-session sub-agents are the stated fallback, never the default.
- **The report appends, never overwrites** — one `## Round N` per review pass.
- **No rework cap.** The human present ends the loop.
- **Never run inside a headless parallel-runner child** — see User-invocable only, above.
- Not a correctness-bug hunt — that is `/code-review`. This command asks whether the change
  follows the repo's standards and implements what was asked.

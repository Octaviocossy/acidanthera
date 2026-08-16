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

**Write the diff to a file** and hand the reviewers that path — never the diff command alone.
Redirect **whichever form you selected above**; the file and the comparison you name in the
prompt must be the same one, or the reviewer reasons about a diff it was not given:

```sh
mkdir -p .worktrees
# default — working tree
git diff $(git merge-base <fixed-point> HEAD) > .worktrees/<branch>.diff
# with committed-only
git diff <fixed-point>...HEAD > .worktrees/<branch>.diff
```

Sanitize `/` to `-` in the branch name, the same convention as the review report (step 6). The
`mkdir` is not ceremonial: a clone where the parallel runner has never run has no `.worktrees/`,
and the directory is already gitignored. This is not an optimization. A reviewer handed a
*command* pages the diff through its own tool calls, and the observed failure mode is the one the
runner already documents where it does the same thing
(`.agents/scripts/run-parallel-issues.sh`, `process_review`): it reads *less* of the diff, reports
more shallowly, and can burn the entire wall-clock cap without emitting anything. It is the same
argument as the corpus pack (ADR-0029), applied to the other large input.

Still state the exact comparison form in the prompt, so a reviewer that needs context around a
hunk knows which comparison produced the file.

The intent-to-add is the **only** index mutation this command makes. It stages no content, and
it is deliberately left in place so the user's `git status` and a later `/ship-note` see a
consistent picture. Do not "clean it up" with a `git reset` — that would unstage whatever the
user had staged on purpose.

### 3 — Run the agentic review

**Dispatch one reviewer process per axis, concurrently** — never one process that forks the two
axes internally (ADR-0030):

```sh
sh .agents/scripts/run-review-agent.sh "<Standards prompt>"   # dispatch A
sh .agents/scripts/run-review-agent.sh "<Spec prompt>"        # dispatch B
```

Issue **both calls in a single message** so they actually run concurrently. Each is an
independent process with its own wall-clock cap, and each one's stdout **is** that axis's report.

The script sources `.agents/parallel.config`, resolves `REVIEW_AGENT_EXEC_CMD` (falling back to
`AGENT_EXEC_CMD` when empty — never to "skip the review"), and appends the prompt as the final
positional argument. The reviewer runs outside this session for one reason: **you wrote this
code**. A reviewer running on your model inherits your blind spots, so the config deliberately
allows a different model than the implementer's (ADR-0028). An in-session sub-agent gets a fresh
*context* but not a fresh *model*, which is the weaker half of the guarantee.

#### Prepare the inputs before dispatching

Every source each axis needs must be **on disk before its prompt is written**. A reviewer that has
to go find a source is a reviewer with an unbounded search space.

```sh
sh .agents/scripts/build-corpus-pack.sh .worktrees/.corpus-pack.md          # Standards
gh issue view <n> --repo <owner>/<repo> --json body -q .body > .worktrees/<branch>.issue.md
```

- **Corpus pack** (ADR-0029) — the verbatim concatenation of every standards source. Hand it to
  the **Standards** dispatch as its complete standards sources, and **never** to the Spec one,
  whose sources are per-change. Axis isolation is blindness between findings, never exclusivity
  over sources (ADR-0024).
- **Issue body** — fetch it with `gh`, not `mcp__github__issue_read`: the MCP tool returns the
  body HTML-sanitized and deletes every `<...>` placeholder, silently corrupting paths and git
  commands in the very document the Spec axis reviews against. If the branch resolves to no
  issue, say so and let the Spec dispatch work from the plan alone.
- **Plan and design spec** — the linked `.agents/plans/` file, and any `.agents/specs/` file it
  or the issue references. Pass paths; they are already on disk.
- **The diff** — the file written in step 2, for **both** axes.

#### What both prompts must carry

Build them from **paths and refs only** — never your own account of what you just implemented.
That summary is precisely the contamination a fresh reviewer exists to avoid. Beyond the
per-axis sources, both prompts state:

- the fixed point from step 1 and the **exact** comparison form from step 2, so the reviewer
  never re-derives it and silently falls back to three-dot;
- that the pre-materialized diff is the change under review, and it should **read that file
  rather than re-running git**;
- that it is **one axis of the two**, working alone: it must not dispatch sub-agents, and must
  not report on the other axis. Its brief and the hard-violation vs judgement-call split are in
  `.agents/skills/standards-and-spec-review/SKILL.md` — the Standards prompt also points at the
  smell baseline there;
- that **every source it needs is already on disk at the named paths**: it must not use GitHub
  tools and must not go looking for sources it was not given. The reviewer may well *have* GitHub
  reachable — a CLI that registers the MCP server from `opencode.json` or `.mcp.json` gets it via
  `.agents/scripts/run-github-mcp.sh`, which sources `.env` itself. Reaching for it is what turns
  a bounded review into an open-ended hunt;
- that this is a **non-interactive run**: it must never stop to ask. If something cannot be
  resolved, note it in the report and continue;
- that its **entire final message is the report**, saved verbatim, under 400 words — without a
  leading `## Standards` / `## Spec` heading, since the presenter adds those when composing.

#### Handling the outcome

| Exit | Meaning | What to do |
|------|---------|------------|
| `0` | report on stdout | use it |
| `124` | exceeded `REVIEW_TIMEOUT` and was killed | report that axis as **timed out**, say so at the gate, and offer to re-run it with a larger `REVIEW_TIMEOUT`. Never present a timed-out axis as a pass |
| `3` / `4` | no reviewer configured / CLI not on `PATH` | fall back (below) |
| other | the reviewer failed | surface its stderr; treat the axis as unreviewed, not as a pass |

Because the axes are separate processes, one can time out while the other returns a full report.
Present what you have and name what you do not — that per-axis visibility is the point of
dispatching them separately.

You do **not** need to stagger the two dispatches or retry them yourself. Agent CLIs keep per-user
state that two simultaneous launches can collide on — opencode fails instantly with
`database is locked` on its one global session store — and `run-review-agent.sh` already absorbs
that: a failure that is fast, non-zero *and* silent is retried once (ADR-0030). What reaches you
is the outcome after that retry.

**Fallback.** On exit `3` or `4`, say so plainly and run the two axes as fresh in-session
sub-agents instead, handed the same paths and refs. Degrading to a same-model reviewer is worse
than an external one and must be stated; skipping the review is not an option — *work is not done
until an agentic review has seen it* (`.agents/ubiquitous-language.md` › invariants).

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
- After each rework round, **return to step 3 with fresh dispatches** — including rebuilding the
  diff file from step 2, which the rework just invalidated — and re-present the gate. A rework can
  break something the previous round passed; skipping the re-review is how that regression
  survives.
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
- **One dispatch per axis, concurrently** (ADR-0030) — never one process that forks the two axes
  internally. Each axis gets its own wall-clock cap and its own visible outcome.
- **Every source arrives by path, pre-materialized** — the corpus pack, the issue body, the plan,
  the design spec, and the diff. A reviewer sent to *find* a source has an unbounded search space,
  and that is what a wall-clock cap exists to catch rather than to permit.
- **A timed-out or failed axis is never presented as a pass.** Say which axis did not report.
- **The report appends, never overwrites** — one `## Round N` per review pass.
- **No rework cap.** The human present ends the loop.
- **Never run inside a headless parallel-runner child** — see User-invocable only, above.
- Not a correctness-bug hunt — that is `/code-review`. This command asks whether the change
  follows the repo's standards and implements what was asked.

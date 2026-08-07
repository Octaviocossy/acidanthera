# Command: handoff

Write a handoff summary of the current conversation so a fresh agent can continue the work, then
**launch that agent as a detached background session** seeded with the summary as its prompt. The
summary is never saved to a file — it *becomes* the child's prompt. The command returns
immediately; the user manages the child with `claude agents`.

The summary's job is to carry **what is not already on disk**: the reasoning behind the current
approach, what was tried and rejected and why, and what the next move is. Everything that *is* on
disk — the issue, the plan, the spec, the ADRs, the commits, the diff — is referenced by path or
`#N`, never pasted. The child starts in the **same working directory**, so every path in the
summary is a path it can open itself; pasting contents only burns its context and goes stale the
moment it is written.

`$ARGUMENTS` is **optional** — a description of what the next session will focus on; tailor the
summary toward it. Two reserved tokens: `with-github` (give the child GitHub MCP access — off by
default, see step 7) and `skip confirm` (launch without the pre-launch review, step 8).

## Context injected by the wrapper

- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output. The input to issue
  resolution (step 2).
- **Working tree state** — the injected `git status --short` output. The child inherits this exact
  tree; the summary must say what each dirty file is mid-way through.
- **Recent commits** — the injected `git log --oneline -5` output. Short SHAs to *cite*, so landed
  work is referenced rather than re-described.
- **Plans** — the injected `ls .agents/plans/` output. Resolves the plan path with no tool call.
- **Specs** — the injected `ls .agents/specs/` output. Same, for `/grill` output.
- **Background agents** — the injected `claude agents --json` output. Entries whose `cwd` equals
  this project root **and** whose `kind` is `background` are prior handoffs from this directory.
  The entry whose `kind` is `interactive` is **this** session — ignore it.

## Launcher

The launcher is a **command prefix**; the handoff summary is appended as the **final quoted
positional argument** — the same contract shape as `AGENT_EXEC_CMD` in
`.agents/rules/parallel-orchestration.md` › Adapter Contract.

| Agent CLI | Launcher | What it does |
|-----------|----------|--------------|
| Claude Code (default, installed) | `claude --bg --name "<name>" …` | Detached background session in the current working directory. Returns immediately. Managed with `claude agents`. |
| OpenCode (installed) | **none — no background mode exists** | `opencode run` is blocking and foreground; `serve` + `attach <url>` is a remote-session model, not a detached job. No job list, no session picker, no `--name`. |
| Codex | **unverified — do not invent one** | Not installed here. Treat as absent. |

The two Claude Code invocations, verified against the installed CLI:

```sh
# DEFAULT — sandboxed from GitHub
claude --bg --name "<name>" --mcp-config '{"mcpServers":{}}' --strict-mcp-config -- "<summary>"

# `with-github` — inherits full GitHub MCP write access
claude --bg --name "<name>" -- "<summary>"
```

**Argument-order invariants.** All three are load-bearing; the invocation breaks or silently
changes meaning if any is violated.

1. **`--bg` first, `--name` second.** The invocation must always begin with the literal string
   `claude --bg --name`, spelled `--bg` (not the `--background` alias). That is what keeps the
   Claude wrapper's `Bash(claude --bg --name:*)` allow-pattern matching; both invocations above
   satisfy it. Mirrors the `--epic`-must-come-first invariant in `parallel-orchestration.md` ›
   Runner Contract. Pinning `--name` into the pattern is deliberate — it turns the mandatory
   display name into an invariant the permission system enforces rather than one to remember.
2. **`--strict-mcp-config` comes *after* `--mcp-config`.** `--mcp-config <configs...>` is
   **variadic**: it keeps consuming arguments until it hits another flag. With the boolean
   `--strict-mcp-config` immediately after it, the list terminates there. Reversed, `--mcp-config`
   swallows the summary as a second config-file path and the command dies with
   `MCP config file not found: <the entire summary>`.
3. **`--` before the summary, always.** The summary is markdown. A line starting with `-` — an
   ordinary bullet — is otherwise parsed as a flag, and the command dies with
   `error: unknown option '- …'`. The `--` separator is not optional hardening; without it this
   command fails on realistic input.

**Where there is no launcher (OpenCode):** do not fake one. Do **not** background `opencode run`
with `&` or `nohup` — that yields an unsupervised process with no job registry, no status, no way
to reattach, and output that survives only in a redirect file this command would then own the
lifecycle of. Instead, complete steps 1–5, **print the summary** for the user to paste into a new
session, and say plainly that no agent was launched. Skip step 6 — there is no child to name. On
OpenCode `/handoff` is a *written* handoff, not a *launched* one.

## Instructions

### 1 — Refuse if a design interrogation is unfinished

If this conversation contains an in-flight `/grill` — a round emitted and not fully answered, or a
settled tree the user has not yet confirmed — **stop and refuse**. Say why, and tell the user to
finish the interrogation (frontier empty → confirm → spec written to `.agents/specs/`) and then
re-run `/handoff`, at which point the spec file is the artifact the child is pointed at and nothing
is left to guess.

Do **not** strip the interrogation and hand off "the rest." Under
`.agents/rules/design-interrogation.md` › Design Tree, every open question blocks the decisions
downstream of it; "the rest" is built on unsettled ground.

The test for what a child may and may not be asked to do is **how it fails**, not whether a human
is present. A background child *can* pause for a human — the user picks it up later via
`claude agents`. `/grill` is forbidden because its documented failure mode is *silent*: with nobody
answering, the agent answers its own questions and writes a spec of fabricated decisions that reads
as legitimate (`design-interrogation.md` › Interactive-Only Boundary; Rounds › Hard stop).
`/execute-issue`'s Phase 1 confirmation is fine by contrast: it fails *loudly*, as a stopped job the
user resumes.

### 2 — Resolve the work's anchors

Identify what already exists so the summary can point at it instead of restating it.

1. **Issue** — apply **precedence #1 only** from `.agents/rules/issue-resolution.md`: strip a
   leading `user/` or `epic/` segment and any conventional-commit prefix, take the first bare
   numeric token, ignore Linear-style `sdp-375` IDs. **Deliberate narrowing:** do *not* run the
   `mcp__github__issue_read` verification, and do *not* fall through to precedences #2–#4. This
   command makes **no GitHub calls at all**; it names `#N` so the child (or the user) can fetch it.
   If the branch yields no numeric token, record "no issue resolves from this branch" and move on —
   never fuzzy-match, never ask, never create.
2. **Plan** — from the injected `ls .agents/plans/`, the file whose header carries `> Issue: #N`
   (`.agents/rules/plan-creation.md`). Read only enough to confirm the match.
3. **Spec** — from the injected `ls .agents/specs/`, the settled design spec this work descends
   from, if any.
4. **ADRs** — any `.agents/adr/NNNN-slug.md` raised or relied on during this conversation. You
   already know these from the transcript; do not go listing the directory.
5. **Commits and dirty files** — from the injected `git log --oneline -5` and `git status --short`.

### 3 — Draft the summary

Compose it with this structure:

```
## Handoff — <one line: what this work is>

**Focus** — what the next session is for. If `$ARGUMENTS` was given, this is it; shape
everything below toward it.

**Anchors** — issue `#N` (or "none on this branch"); plan `.agents/plans/<file>.md`; spec
`.agents/specs/<file>.md`; ADRs `.agents/adr/<file>.md`. Paths and numbers only. Do not
restate their contents — the child can open them.

**Where things stand** — the uncommitted files from `git status --short`, one line each on
what that file is mid-way through and what it still needs. Landed work by short SHA. Never a
re-description of the diff; the child can run `git diff`.

**Reasoning not on disk** — the approach chosen and why; the alternatives considered and
rejected, with the reason each was rejected; constraints and gotchas discovered this session
that are recorded nowhere. This section exists in no artifact. Be generous here — it is the
entire reason this command exists.

**Next moves** — ordered and concrete. Each one must be actionable without asking a question.

**Suggested skills** — see step 4.

**Boundaries** — the standing constraints from step 7, restated as instructions to the child.

_Handed off from branch `<branch>` via `/handoff`._
```

### 4 — Ground the "suggested skills" section

Name only commands and skills that exist in **this** repo's catalog — the child loads the same
`.claude/commands/` and `.agents/skills/`, so a suggestion for something absent is a dead end. Lead
each with its **trigger**, not its name (the same "lead with the trigger" discipline
`.agents/rules/skill-creation.md` requires of a skill `description`).

The section is **mode-dependent**. In the default sandboxed mode the child has no GitHub tools at
all, so every GitHub-backed command is unavailable to it — say so rather than suggesting something
that will fail on first use.

| When the child hits this | Default (sandboxed) | `with-github` |
|---|---|---|
| A git merge or rebase goes into conflict | `resolving-merge-conflicts` — a skill, so it loads on its own; naming it is a reminder, not a requirement | same |
| A commit message is needed | `/commit-message` | same |
| An issue and plan exist and the work is to implement them | Work from the **local** `.agents/plans/` file — `/execute-issue` cannot fetch the issue body | `/execute-issue`, and say explicitly whether it should **stop at the Phase 1 confirmation and wait** (default, recommended) or treat Phase 1 as pre-approved |
| Implementation is finished and needs recording | **Report back — the user runs `/ship-note`** | `/ship-note` — posts a comment, never closes the issue |
| A note needs to go on the issue mid-flight | **Report back** | `/comment-issue` |
| The work turns out to be 3–8 independent slices | `/spec-breakdown`, but never start an epic unattended | same |
| The design is not actually settled | **Nothing.** `/grill` is forbidden (step 1). Stop and report back | same |

The default mode's omissions are deliberate, and they mirror the split the parallel runner already
uses: headless children do the work, the session agent does GitHub.

The `/execute-issue` recommendation to **wait** at Phase 1 is likewise deliberate. The parallel
runner pre-approves Phase 1 because its children cannot be resumed; a background child *can* be, so
waiting is the safer default.

### 5 — Redact

The summary becomes a **shell command argument**. It lands in shell history and in the process
table, where `ps auxww` exposes it to every local process — not just to the child. Treat it as
public.

- Never inline the **value** of anything from `.env` / `.env.local`. Name the variable
  (`GITHUB_TOKEN`) and the file path; never the value.
- Never paste raw `git diff`, log, or MCP-server output that could carry a credential.
- Strip personally identifying information.

There is never a reason to inline a secret anyway: the child starts in this directory and can read
`.env` itself. Inlining is not merely unsafe, it is pointless.

State in step 8 how many redactions were applied, or "none needed."

### 6 — Name the child

`--name` is mandatory. It sets the display name in the job list, the session picker, and the
terminal title, and it is the `name` field you will match on in `claude agents --json`, so make it
unique enough to find later.

- Issue resolved → `#<N> <short title>` (e.g. `#42 offline sync retry`).
- No issue → a short imperative phrase (e.g. `Fix login bug`).

Keep it short — it becomes a terminal title.

### 7 — Build the invocation and fix the child's boundaries

Pick the launcher from the `## Launcher` table and honor all three argument-order invariants. On
OpenCode, skip to printing (see that section). On Claude Code, default to the **sandboxed** form.

**Why sandboxed is the default.** The child starts in this project directory, so by default it
would load `.mcp.json` → `.agents/scripts/run-github-mcp.sh`, which sources `.env` and exports
`GITHUB_PERSONAL_ACCESS_TOKEN`. That grants full GitHub MCP **write** access — closing issues,
editing bodies and labels, opening, updating, and **merging** pull requests, pushing and deleting
files. It also **inverts** the security position in `parallel-orchestration.md` › Adapter Contract,
which states that `GITHUB_TOKEN` is never sourced by the runner and that "headless agents have no
GitHub access by design." A `--bg` child is not covered by that guarantee, so this command opts out
explicitly with `--mcp-config '{"mcpServers":{}}' --strict-mcp-config`, restoring
runner-equivalent isolation. Reasoning in `.agents/adr/0002-handoff-shares-the-working-tree.md`.

**Never pass `--dangerously-skip-permissions`,** in either mode. The parallel runner passes it
because its children are sandboxed in a throwaway worktree *with no GitHub access*. A `--bg` child
is in the **real** working tree — so on normal permission handling, its state-changing actions
surface for approval through `claude agents` instead of executing unattended.

**When `$ARGUMENTS` contains `with-github`,** drop the two MCP flags and write these boundaries
verbatim into the summary's `**Boundaries**` section:

- **Read GitHub freely. Comment freely** (`/comment-issue`, `/ship-note`). Those are the sanctioned
  outward-facing writes.
- **Never close an issue.** `/ship-note` deliberately does not close; closing is a human checkpoint.
  Only `/execute-epic` closes children, and only after a verified merge.
- **Never merge a pull request.** `main` receives work only through a reviewed PR.
- **Never push to `main` or to an `epic/*` integration branch.** The epic branch has a single
  documented writer — the parallel runner, serialized through `.worktrees/.merge.lock`.
- **Never delete a branch.** Branch lifecycle belongs to the runner (`KEEP_CHILD_BRANCHES`).
- **Never edit an issue's title, labels, or state.**
- **Never invoke `/grill`,** and never start `/execute-epic` or `/spec` unattended.

These are prose in a prompt, not an enforced capability boundary — which is exactly why the
sandboxed mode is the default and this one is opt-in.

### 8 — Confirm before launching

Unless `$ARGUMENTS` contains `skip confirm`, print and wait for explicit confirmation:

- The child's **`--name`**.
- The **full summary**, verbatim — it *is* the prompt, so the user must read it, not a précis.
- The **exact launcher command** that will run.
- **Capabilities:** the working directory; whether GitHub MCP is sandboxed (default) or inherited
  (`with-github`); the permission mode.
- **Redactions applied**, or "none needed."
- **Duplicate-job warning:** if the injected `claude agents --json` contains a `background` entry
  whose `cwd` equals this project root, say so by name and warn that launching a second child puts
  two agents in one working tree. This command is **not** idempotent — every invocation spawns a
  new job.

### 9 — Launch and report

Run the launcher via the Bash tool. It returns immediately, printing the child's short id (e.g.
`1971897e`) — the same value `claude agents --json` exposes as `id` on background entries. Report
to the user:

- The child's name and short id.
- The four ways to reach it, by name:

  | Command | Does |
  |---------|------|
  | `claude agents` | list every session |
  | `claude attach <id>` | open it in this terminal |
  | `claude logs <id>` | show recent output (a raw terminal replay — for reading, not parsing) |
  | `claude stop <id>` | stop it |

- **The baton has passed.** Advise the user to stop editing this working tree; see `## Rules`.

## Rules

- **A handoff is a baton pass, not a fork.** The child shares this working tree — there is no
  worktree isolation here, unlike `/execute-epic`. Two agents editing one checkout **will** collide.
  Hand off and stop working, or expect conflicts you resolve by hand.
- **Never hand off an unfinished `/grill`.** Refuse, don't degrade. The failure mode is silent
  fabrication of decisions (`design-interrogation.md` › Interactive-Only Boundary).
- **GitHub is off by default.** `with-github` is opt-in, flagged at confirmation, and constrained by
  the Boundaries block. Never pass `--dangerously-skip-permissions` in either mode.
- **Honor all three argument-order invariants.** `claude --bg --name` first, `--strict-mcp-config`
  after `--mcp-config`, `--` before the summary. Each has a concrete failure mode; see `## Launcher`.
- **`--name` is mandatory.** It is the only handle the user has on the job.
- **Reference, never duplicate.** Paths and `#N` for anything on disk. Inline only what exists
  nowhere else: the reasoning, the rejected alternatives, the current intent.
- **Redact before launching.** The summary is argv — visible in the process table and shell history.
- **No GitHub calls.** This command reads only injected shell output and this conversation. It
  applies `issue-resolution.md` precedence #1 without verification and never falls through to #2–#4.
- **Not idempotent.** Every run spawns a job. Warn on an existing background job in this cwd.
- **One continuous thread, not a fan-out.** If what you are about to hand off is really "N
  independent slices," that is `/spec-breakdown` → `/execute-epic`, not `/handoff`.

## `/handoff` versus `/execute-epic`

Different axes: one is **continuity over time**, the other is **parallelism over a decomposition**.

| | `/handoff` | `/execute-epic` |
|---|---|---|
| Children | exactly one | N, one per child issue, capped by `PARALLEL_MAX_CONCURRENCY` |
| Seeded from | this conversation's live state | a GitHub issue body / plan file |
| Isolation | **none** — same cwd, same working tree | one git worktree per child |
| GitHub access | off by default; `with-github` to opt in | none — token never sourced |
| Permissions | normal prompting | `--dangerously-skip-permissions` |
| Commits / pushes | the child's own, under supervision | the runner's; the agent never commits |
| Integration | none | auto-merge into the epic branch, single writer |
| Idempotent | no | yes — done children detected and skipped |
| Supervision | `claude agents` (the user) | the runner waits, collects, cleans up |
| Ends with | a running job | one `epic → main` pull request |

---

*Vendored from [`mattpocock/skills`](https://github.com/mattpocock/skills) —
`skills/in-progress/claude-handoff/SKILL.md` (upstream marks it **in-progress**, i.e. unstable).
Upstream ships it as a skill with `disable-model-invocation: true`; per
`.agents/rules/skill-creation.md` ("A skill that must never auto-load … belongs in
`.agents/commands/` with `disable-model-invocation: true`, not here") it is a **command** in this
repo, and the `claude-` prefix is dropped for cross-agent parity. Upstream's instructions —
summary-becomes-prompt, mandatory `--name`, a suggested-skills section, reference-don't-duplicate,
redaction, `$ARGUMENTS` as the next session's focus — are preserved above. The `## Launcher` table,
the argument-order invariants, the two guards (unfinished interrogation; GitHub capability), the
sandboxed default, the confirmation step, and the `/execute-epic` boundary are local.*

# `/handoff` shares the working tree, and its child is sandboxed from GitHub by default

`/execute-epic` isolates every child in its own git worktree with no GitHub access, because its
children are independent and unsupervised. `/handoff` is the opposite case: it carries *this*
conversation forward, so the child must inherit the uncommitted working tree — which rules out
worktree isolation and leaves "hand off and stop editing" as a behavioral rule rather than a
structural guarantee. Because that child then runs in the **real** tree, it launches with
`--mcp-config '{"mcpServers":{}}' --strict-mcp-config` (GitHub off; `with-github` to opt in) and
never with `--dangerously-skip-permissions`: the parallel runner may grant its children broad
permissions precisely *because* they are sandboxed, and a `--bg` child is not.

## Consequences

A default-mode child cannot run `/execute-issue`, `/ship-note`, or `/comment-issue` — they all need
GitHub. That is intended, and mirrors the split the runner already uses: headless children do the
work, the session agent does GitHub. The child works from the local `.agents/plans/` file and
reports back.

Without this opt-out the child would silently inherit full GitHub **write** access, because it
starts in the project directory and loads `.mcp.json` → `.agents/scripts/run-github-mcp.sh`, which
sources `.env`. That contradicts `parallel-orchestration.md` › Adapter Contract ("headless agents
have no GitHub access by design"), which covers the runner but not a `--bg` child.

> Raised by: `/handoff` adoption, 2026-08-06. See `.agents/commands/handoff.md`.

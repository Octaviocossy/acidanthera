# The interactive reviewer runs under `REVIEW_AGENT_EXEC_CMD`, not as an in-session sub-agent

`/review-branch` dispatches its reviewer as an external process through
`.agents/scripts/run-review-agent.sh`, which resolves `REVIEW_AGENT_EXEC_CMD` from
`.agents/parallel.config` — the same config key, and the same command-prefix contract, the
parallel runner's `--review` action already uses.

The interactive gate reviews code the session itself just wrote. An in-session sub-agent gives
that review a fresh *context* but not a fresh *model*, so it inherits every blind spot the
implementer has. Routing through `REVIEW_AGENT_EXEC_CMD` is what makes "a fresh context that did
not write the code" mean something stronger than fresh scrollback, and it is why that key exists
on the headless path in the first place.

## Considered Options

- **Fresh in-session sub-agents** (the original design). Kept only as a **fallback**, for a
  clone with no `.agents/parallel.config` or a configured CLI missing from `PATH`. It must be
  announced when it happens, because it is the weaker check — but it still beats skipping the
  review, which no path may do.
- **Hardcoding the reviewer CLI in the command wrapper's `allowed-tools`.** Rejected: the config
  is gitignored and per-machine, so a wrapper naming `opencode` would break the moment the model
  changes. The wrapper pre-approves the script; the script reads the config.

## Consequences

The report arrives as one blob at the end of an external process rather than streaming into the
session.

`run-review-agent.sh` does not source `GITHUB_TOKEN`, and the caller must fetch any issue body
first and pass it by path, exactly as the runner does. That is **not** the same as the reviewer
having no GitHub access, which this ADR originally claimed: a reviewer CLI that reads
`opencode.json` or `.mcp.json` launches the GitHub MCP server through
`.agents/scripts/run-github-mcp.sh`, and *that* script sources `.env` itself. So the token reaches
the reviewer by a path this script does not control, and no CLI flag reliably suppresses it
(opencode's `--pure` disables plugins, not MCP servers).

Passing sources by path therefore has to be enforced by the prompt, not assumed from the
environment: an external reviewer with GitHub reachable and no pre-fetched issue will go hunting
through it, which is exactly how a review of three files ran past forty minutes. `/review-branch`
step 3 states the prohibition explicitly, and `REVIEW_TIMEOUT` (ADR-0030) bounds what happens when
a reviewer ignores it.

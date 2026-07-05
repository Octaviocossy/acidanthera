# Rule: Cross-Agent Command Creation (Claude Code + OpenCode)

Slash commands target Claude Code and OpenCode, which share the same command feature
set. Keep one canonical spec in `.agents/commands/` and add a thin wrapper per agent
that references it — the same bridge pattern used for rules and the domain glossary.

## Layout

```
.agents/commands/<name>.md     # canonical, agent-agnostic spec (source of truth)
.claude/commands/<name>.md     # Claude Code wrapper
.opencode/commands/<name>.md   # OpenCode wrapper
```

Invoke in either agent with `/<name>`.

## Shared feature set

Claude Code and OpenCode both support:

- **YAML frontmatter** — at minimum `description`.
- **Shell injection** — `` !`cmd` `` runs the command and inlines its output before the
  model sees the prompt. The `!` must start the line.
- **File include** — `@path/to/file.md` inlines that file's contents.
- **Arguments** — `$ARGUMENTS` (all args); positional `$1`, `$2`, …

Because the feature set is identical, the two wrappers have **identical bodies** and
differ only in agent-specific frontmatter:

| Field | Claude Code | OpenCode |
|-------|-------------|----------|
| `description` | yes | yes |
| `allowed-tools` (pre-approve injected shell) | yes | n/a (permissions are agent-level) |
| `disable-model-invocation` (user-only) | yes | n/a |
| model / agent selection | `model` | `agent`, `model` |

## How to add a command

1. **Canonical spec** — `.agents/commands/<name>.md`: purpose, the shell context the
   command needs (exact commands), and agent-neutral instructions. No agent-specific syntax.
2. **Claude wrapper** — `.claude/commands/<name>.md`: frontmatter (`description`,
   `allowed-tools` for any injected shell, optional `argument-hint` /
   `disable-model-invocation`), the `` !`cmd` `` injection lines, `$ARGUMENTS`, then
   `@.agents/commands/<name>.md`.
3. **OpenCode wrapper** — `.opencode/commands/<name>.md`: the **same body** as the Claude
   wrapper, with frontmatter reduced to `description` (add `agent` / `model` only if needed).

## Orchestration commands

A command may invoke a project script under `.agents/scripts/` **as a model tool call
during execution** — for example, calling the parallel runner with model-computed
arguments. This is distinct from a `` !`cmd` `` shell injection, which executes once
before the model sees the prompt and cannot use model-computed arguments.

Wrapper **bodies stay identical** across Claude Code and OpenCode; only the frontmatter
differs (the same frontmatter-only divergence that already applies to injected shell):

- **Claude Code:** pre-approve the call via
  `allowed-tools: Bash(sh .agents/scripts/<script>:*)`.
- **OpenCode:** the agent-level permission setting authorizes the call.

## Rules

- The canonical spec is the single source of truth; wrappers must not diverge in intent.
- Keep the Claude and OpenCode wrapper **bodies identical** — only frontmatter may differ.
- Keep `` !`cmd` `` injection lines clean — the `!` must start the line.
- When you add a command, list it under `## Slash Commands` in `AGENTS.md`.

# Command: custom-init

Bootstrap the cross-agent governance scaffold in a target project directory by running the
manifest-driven copier script.

## Purpose

This command installs the full cross-agent governance architecture — rules, ubiquitous
language, and slash commands (Claude Code, OpenCode) — into a target directory, driven by
`.agents/scaffold.manifest`. It is **safe to run repeatedly**: any file that already exists in
the target is left untouched and reported as skipped.

`$ARGUMENTS`, if given, is the target directory. If empty, the target is the current working
directory.

## How it works

The scaffold source is this repository (or a checkout/clone of it) — the same tree that
contains `.agents/scripts/init-scaffold.sh` and `.agents/scaffold.manifest`. The script
resolves its own source root from its own file path, reads the manifest line by line
(directories with a trailing `/` are copied recursively, everything else is a single file),
and copies each entry into the target unless a file of the same name already exists there.

## Instructions

1. Determine the target directory from `$ARGUMENTS` (trimmed). If empty, use the current
   working directory.
2. Run the copier script via the Bash tool:
   - If a target directory was given: `sh .agents/scripts/init-scaffold.sh "<target-dir>"`
   - If not: `sh .agents/scripts/init-scaffold.sh`
3. Relay the script's `✓ created` / `⊘ skipped` lines and its final summary (`Created: N
   files`, `Skipped: N files`) to the user.
4. If `Created` is greater than 0, remind the user to:
   - Fill in the TODO placeholders in `AGENTS.md` (`## Workspace`, `## Commands`,
     `## Verification Quirks`, `## Skills`, `## Code Structure`).
   - Customize `.agents/ubiquitous-language.md` (the `Last updated` date and the canonical
     domain code path).
   - Fill in the canonical domain code paths in `.agents/rules/domain-glossary.md`.
   - Configure the GitHub MCP server (`GITHUB_TOKEN` in `.env`,
     `brew install github-mcp-server`) if they intend to use the issue-aware commands
     (`create-issue`, `update-issue`, `execute-issue`, `comment-issue`, `ship-note`).
   - Copy `.agents/parallel.config.example` → `.agents/parallel.config` and set
     `AGENT_EXEC_CMD` if they intend to use `/spec-breakdown`, `/execute-epic`, or `/spec`.
5. Optional global install tip: to invoke `/custom-init` from any project, copy
   `.agents/commands/custom-init.md` (and its two wrappers) to the agent's global commands
   directory, and keep a local clone of this scaffold repo around as the source the script
   resolves itself against — always invoke the script from inside that clone, passing the
   real project directory as the target.

## Rules

- Never overwrite a file that already exists in the target — only fill gaps.
- Do not re-embed file templates in this command; `.agents/scaffold.manifest` and
  `.agents/scripts/init-scaffold.sh` are the single source of truth for what gets installed.

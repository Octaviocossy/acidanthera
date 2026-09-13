# Command: install-scaffold

Install or update the cross-agent governance scaffold in a target project directory by running
the manifest-driven sync script.

## Purpose

This command brings a target directory's copy of the full cross-agent governance architecture —
rules, ubiquitous language, skills, and slash commands (Claude Code, OpenCode) — into line with
this scaffold, driven by `.agents/scaffold.manifest`. It is a **sync, not a one-shot copy**: on a
first run it creates everything, and on every later run it delivers what the target lacks and
updates the scaffold-owned files the target never touched. Where the two sides have genuinely
diverged it writes conflict markers — or a `<path>.scaffold-conflict` sidecar, where the path
cannot hold them (ADR-0020) — and exits non-zero rather than choosing for you (ADR-0019).

`$ARGUMENTS`, if given, is the target directory. If empty, the target is the current working
directory.

## How it works

The scaffold source is this repository (or a checkout/clone of it) — the same tree that
contains `.agents/scripts/install-scaffold.sh` and `.agents/scaffold.manifest`. The script
resolves its own source root from its own file path, reads the manifest line by line
(directories with a trailing `/` are copied recursively, everything else is a single file),
and gives each entry one of six outcomes:

| Outcome | When |
|---------|------|
| `✓ created` | the destination does not exist |
| `↻ updated` | the destination still holds the state the two sides last agreed on, untouched, and the scaffold has moved on |
| `= unchanged` | the destination is identical to the source, or neither side has moved since they last agreed |
| `↺ resolved` | conflict markers a previous sync wrote are gone, or its conflict sidecar was deleted, so the destination becomes the new agreed state |
| `⊘ skipped` | the destination diverges and the entry is project-owned |
| `⚠ conflict` | the destination diverges and the entry is scaffold-owned — the target edited a file it does not author — so the file is rewritten with conflict markers, or, when the path cannot hold text (a symlink, a directory), a conflict sidecar `<path>.scaffold-conflict` is written beside it (ADR-0020) — or the path lies beneath an ancestor that is not a real directory (a symlink, or a file where a directory should be), in which case it is refused unread and nothing is written for it |

**Ownership** decides which files can be updated or conflict at all, and is declared in the
manifest by `# @owner scaffold` / `# @owner project` directives, each applying to every entry
below it until the next one. Scaffold-owned means the scaffold authors the file and the project is
not its author — the rules, the command specs and wrappers, the scripts, the skills, the ADRs, the
docs, and the scaffold's own vocabulary and invariants. Project-owned means the scaffold seeds it
and the project fills it in — `AGENTS.md`, `CLAUDE.md`, `.agents/ubiquitous-language.md`, the
generated index, the changelog, `.agents/labels.md`, `.env.example`, `.gitignore`, `.mcp.json`,
`opencode.json`, `.agents/parallel.config.example`. Anything a directive does not cover is
project-owned, which behaves exactly as the old copier did.

Telling "the scaffold moved and the target did not" apart from "the target edited this" needs a
record of what the two sides last agreed on, so the script keeps one at
`<target>/.agents/scaffold.baseline` and rewrites it after every run: per path, what the scaffold
delivered, what the destination looked like at that agreement, and whether markers are still
outstanding. It is meant to be committed with the project; without it the script cannot prove a
scaffold-owned file is untouched, so it conflicts rather than overwrite.

That last field is what lets a conflict **end**. Once the markers are gone the destination is
accepted as the new agreed state — including a resolution that kept some of the project's
content — so the sync reports it `resolved` once and `unchanged` on every run after that. A later
scaffold-side change to the same file still lands as an `updated`, which is why the
`resolving-scaffold-sync` skill moves project content into a file the project actually owns
instead of leaving it in one the scaffold rewrites.

## Instructions

1. Determine the target directory from `$ARGUMENTS` (trimmed). If empty, use the current
   working directory.
2. Run the sync script via the Bash tool:
   - If a target directory was given: `sh .agents/scripts/install-scaffold.sh "<target-dir>"`
   - If not: `sh .agents/scripts/install-scaffold.sh`
3. Relay the script's per-entry lines and its final summary (`Created`, `Updated`, `Unchanged`,
   `Resolved`, `Skipped`, `Conflicts`) to the user. Do not summarize a conflicted run as a success.
4. **If the script exits non-zero**, it wrote conflict markers into one or more scaffold-owned
   files — or a conflict sidecar beside a path that cannot hold them — and named every conflicted
   path in its closing block. Relay that list, state plainly that the sync is incomplete until they
   are resolved, and resolve them with the `resolving-scaffold-sync` skill — which establishes each
   side's intent, removes every marker and sidecar, and re-runs the sync and `verify-scaffold.sh`.
   Never hand-wave a conflict away by re-running the script: a re-run detects the unresolved marks
   and refuses to exit 0. A path reported *beneath …, which is not a directory* carries no marker
   and no sidecar: the sync neither read nor wrote it, because an ancestor of the path is a symlink
   or a file. Replace that ancestor with a real directory, then re-run.
5. If `Created` is greater than 0, remind the user to:
   - Fill in the TODO placeholders in `AGENTS.md` (`## Workspace`, `## Commands`,
     `## Testing`, `## Verification Quirks`, `## Code Structure`).
   - Customize `.agents/ubiquitous-language.md` — the **project's own** domain vocabulary (the
     `Last updated` date and the canonical domain code path). Leave
     `.agents/ubiquitous-language-scaffold.md` alone; it is owned by the scaffold (ADR-0017).
     New invariants go in `.agents/ubiquitous-language-invariants.md`, and
     `.agents/ubiquitous-language-index.md` is generated — never hand-edited.
   - Fill in the canonical domain code paths in `.agents/rules/domain-glossary.md`, and the
     runner, file placement, and test command in `.agents/rules/testing.md` — that rule and
     `AGENTS.md` must not be left silently disagreeing.
   - Configure the GitHub MCP server (`GITHUB_TOKEN` in `.env`,
     `brew install github-mcp-server`) if they intend to use the issue-aware commands
     (`create-issue`, `update-issue`, `execute-issue`, `comment-issue`, `ship-note`).
   - Copy `.agents/parallel.config.example` → `.agents/parallel.config` and set
     `AGENT_EXEC_CMD` if they intend to use `/spec-breakdown`, `/execute-epic`, or `/spec`.
   - Commit `.agents/scaffold.baseline` along with the rest, so the next sync can tell their
     edits from the scaffold's.
6. Optional global install tip: to invoke `/install-scaffold` from any project, copy
   `.agents/commands/install-scaffold.md` (and its two wrappers) to the agent's global commands
   directory, and keep a local clone of this scaffold repo around as the source the script
   resolves itself against — always invoke the script from inside that clone, passing the
   real project directory as the target. Pull that clone before syncing: it is the version the
   target is brought up to date with.

## Rules

- Overwrite only what the manifest declares scaffold-owned **and** the target has not edited.
  A project-owned file that diverges is left exactly as it is; a scaffold-owned one that both
  sides changed is conflict-marked, never silently resolved.
- A conflicted sync is a failed sync: report it as such, and never present a non-zero exit as a
  completed install.
- Do not re-embed file templates in this command; `.agents/scaffold.manifest` and
  `.agents/scripts/install-scaffold.sh` are the single source of truth for what gets installed.

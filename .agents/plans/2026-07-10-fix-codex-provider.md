# Plan: Fix the Codex provider (chat produces no output)

> Status: **in-progress**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _none_

## Goal

Make the Codex engine actually work in the chat panel. Today, selecting a Codex model (GPT 5.4 mini / GPT 5.5 fast) and sending a message yields no visible response. Fix the adapter's event mapping and the CLI flags so Codex turns render (messages, reasoning, tool calls) and multi-turn resume works — validated against the real `codex-cli 0.143.0` stream.

## Context

**What exists today.** `src/lib/agent/backends/codex.backend.ts` translates `codex exec --json` output into `AgentEvent`s. It was written **without a real Codex install** — the glossary and the file's own header comment flag the mapping as "best-effort from the CLI's documented schema, not a captured real stream." Codex is **now installed** (`/opt/homebrew/bin/codex`, `codex-cli 0.143.0`), so the guesses can finally be checked — and three of them are wrong.

**What prompted this work.** User report: "codex provider is not working." Reproduction log:

```
agent_spawn: command=codex args=["exec", "--model", "gpt-5.4-mini", "--json", "--full-auto", "Hi!, what model are you?"] cwd=/Users/ovct/Documents/orbit-brain
```

**Root causes (all confirmed by capturing the real stream — see Architecture Decisions for the raw captures):**

1. **[CRITICAL] Item field is `type`, not `item_type`.** Real items look like `{"id":"item_0","type":"agent_message","text":"Hello"}`. The adapter reads `item.item_type`, which is always `undefined`, so **every** item branch (agent_message, reasoning, tool calls) fails to match and emits nothing. The chat receives only `turn_done` → the agent appears to reply with nothing. This is the primary visible symptom.

2. **[CRITICAL] Missing `--skip-git-repo-check`.** The default vault `~/Documents/orbit-brain` is not a git repository. Without this flag Codex refuses to run at all — `Not inside a trusted directory and --skip-git-repo-check was not specified.` — and exits, producing nothing (or an "exited unexpectedly" error).

3. **[CRITICAL] `--full-auto` is invalid on `codex exec resume`.** The code sends one shared `CODEX_FLAGS` array to both `codex exec` (turn 1) and `codex exec resume` (turns 2+). But `resume` rejects `--full-auto` **and** `--sandbox` (`error: unexpected argument '--full-auto' found`). So every follow-up turn in a conversation crashes. (`--full-auto` is *also* deprecated on the first turn — it only warns there.)

**Ruled out (investigated, NOT bugs):**

- **stdin does not block.** Codex prints `Reading additional input from stdin...` because Tauri spawns it with a piped, never-closed stdin. But with a prompt passed as an arg it does **not** wait for EOF — verified by holding stdin open 8s; Codex replied immediately. No change required (an optional hardening is noted in Open Questions).
- **The fictional model id is accepted.** `--model gpt-5.4-mini` does not error — Codex passes the string through without validation. The placeholder model catalog can stay as-is.

**Constraints.**
- No test runner is configured; validation is `pnpm build` + `pnpm lint` + a manual smoke test.
- This is a frontend-only fix. `src-tauri/src/agent.rs` (the generic spawner) is correct and must not change — the bug is entirely in the Codex adapter's arg construction and field names.
- Per `.agents/rules/domain-glossary.md`, the glossary's Codex entry (which asserts "Codex is not installed on this dev machine") must be corrected.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/lib/agent/backends/codex.backend.ts` | Fix item field name (`item_type`→`type`), replace flags with a resume-safe set, re-pin the header comment |
| MODIFY | `.agents/ubiquitous-language.md` | Correct the Codex backend entry (now pinned against `codex-cli 0.143.0`), bump "Last updated", add a changelog row |

## Step-by-Step Implementation

All edits are in `src/lib/agent/backends/codex.backend.ts` except Step 6.

> **Step 1 — Replace the flag constant with a resume-safe common set**
>
> - **File:** `src/lib/agent/backends/codex.backend.ts`
> - **Action:** MODIFY (lines 6–8)
> - **Details:** Replace:
>   ```ts
>   const CODEX_COMMAND = 'codex';
>   /** `--full-auto` is Codex's equivalent of Claude Code's `--allowedTools` scoping (doc/v0-spec.md §4.4): auto-approve, sandboxed to the vault. */
>   const CODEX_FLAGS = ['--json', '--full-auto'];
>   ```
>   with:
>   ```ts
>   const CODEX_COMMAND = 'codex';
>   /**
>    * Flags shared by the first turn (`codex exec`) and every resume turn (`codex exec resume`).
>    * `--skip-git-repo-check` is required because a vault is not a git repo — Codex otherwise
>    * refuses to run ("Not inside a trusted directory"). The sandbox is set via a `-c` config
>    * override rather than `--sandbox`/`--full-auto` because `codex exec resume` rejects both of
>    * those flags; only `-c` is accepted by both subcommands. This is Codex's equivalent of Claude
>    * Code's `--allowedTools` scoping (doc/v0-spec.md §4.4): auto-run, sandboxed to the vault.
>    */
>   const CODEX_COMMON_FLAGS = ['--json', '--skip-git-repo-check', '-c', 'sandbox_mode="workspace-write"'];
>   ```
> - **Why:** `--full-auto` is deprecated and — critically — unsupported by `resume`; `--skip-git-repo-check` is what lets Codex run inside a non-git vault. The `-c sandbox_mode="workspace-write"` form is the only sandbox setter both subcommands accept.
> - **NOTE for the implementer:** the array element is the literal string `sandbox_mode="workspace-write"` — the inner double-quotes are part of the value (Codex parses the portion after `=` as TOML, so the quotes make it the TOML string `workspace-write`). Do not strip them. No shell is involved (Rust `Command` passes args verbatim), so no extra escaping is needed.

> **Step 2 — Rename the item-kind field in the `CodexItem` interface**
>
> - **File:** `src/lib/agent/backends/codex.backend.ts`
> - **Action:** MODIFY (line 19)
> - **Details:** In `interface CodexItem`, change `item_type?: string;` to `type?: string;`. Leave every other field unchanged.
> - **Why:** The real `--json` stream keys the item kind under `item.type`. `CodexStreamLine.type` (the line-level kind) is a **different object's** field — no conflict.

> **Step 3 — Update `toolArgs` to switch on `item.type`**
>
> - **File:** `src/lib/agent/backends/codex.backend.ts`
> - **Action:** MODIFY (line 41)
> - **Details:** Change `switch (item.item_type) {` to `switch (item.type) {`. The `case` labels stay the same.
> - **Why:** Same field rename.

> **Step 4 — Update every `item.item_type` read in `translateItem`**
>
> - **File:** `src/lib/agent/backends/codex.backend.ts`
> - **Action:** MODIFY (lines 79–110, the body of `translateItem`)
> - **Details:** Replace all remaining `item.item_type` occurrences with `item.type`. After the edit `translateItem` reads:
>   ```ts
>   function translateItem(item: CodexItem, lineType: 'item.started' | 'item.completed', source: AgentSource, timestamp: number, emit: (event: AgentEvent) => void): void {
>     if (item.type === 'reasoning') {
>       // Surfaced as its own event so the UI can render it distinctly from `agent_message` (#49).
>       if (lineType === 'item.completed' && item.text) {
>         emit({ type: 'agent_reasoning', messageId: nextMessageId(), text: item.text, timestamp, source });
>       }
>       return;
>     }
>
>     if (item.type === 'agent_message') {
>       if (lineType === 'item.completed' && item.text) {
>         emit({ type: 'agent_message', messageId: nextMessageId(), text: item.text, timestamp, source });
>       }
>       return;
>     }
>
>     if (!item.type || !TOOL_ITEM_TYPES.has(item.type) || !item.id) return;
>
>     if (lineType === 'item.started') {
>       emit({ type: 'tool_call_start', callId: item.id, toolName: item.type, args: toolArgs(item), timestamp, source });
>       return;
>     }
>
>     const isError = item.status === 'failed' || (item.type === 'command_execution' && item.exit_code !== undefined && item.exit_code !== 0);
>     emit({
>       type: 'tool_call_result',
>       callId: item.id,
>       toolName: item.type,
>       status: isError ? 'error' : 'ok',
>       result: isError ? undefined : (item.aggregated_output ?? item.changes),
>       errorMessage: isError ? (item.aggregated_output ?? `${item.type} failed.`) : undefined,
>       timestamp,
>       source,
>     });
>   }
>   ```
>   (Six `item.item_type` → `item.type` replacements: the two guards, the `TOOL_ITEM_TYPES.has` check, the two `toolName` assignments, the `command_execution` comparison, and the `` `${...} failed.` `` template.)
> - **Why:** This is the fix that makes any content render at all. Verified item kinds from the real stream: `agent_message`, `reasoning`, `command_execution` (all confirmed present with these exact `type` values).

> **Step 5 — Build the resume-safe arg arrays in `send`**
>
> - **File:** `src/lib/agent/backends/codex.backend.ts`
> - **Action:** MODIFY (line 173)
> - **Details:** Replace:
>   ```ts
>   const args = threadId ? ['exec', 'resume', threadId, '--model', model, ...CODEX_FLAGS, prompt] : ['exec', '--model', model, ...CODEX_FLAGS, prompt];
>   ```
>   with:
>   ```ts
>   const args = threadId
>     ? ['exec', 'resume', threadId, ...CODEX_COMMON_FLAGS, '--model', model, prompt]
>     : ['exec', ...CODEX_COMMON_FLAGS, '--model', model, prompt];
>   ```
> - **Why:** Both subcommands now get `--json --skip-git-repo-check -c sandbox_mode="workspace-write"`; they differ only by the `resume <threadId>` positional. Verified against a live session: `codex exec resume <uuid> --json --skip-git-repo-check -c 'sandbox_mode="workspace-write"' --model gpt-5.4-mini "<prompt>"` resumes the same `thread_id` and replies correctly.

> **Step 6 — Re-pin the file header comment**
>
> - **File:** `src/lib/agent/backends/codex.backend.ts`
> - **Action:** MODIFY (lines 10–16, the block comment above `interface CodexItem`)
> - **Details:** Replace the "Codex is not installed on this machine … best-effort … Re-pin against a captured stream once Codex is available locally" comment with one that matches the Claude Code adapter's now-pinned tone, e.g.:
>   ```ts
>   /**
>    * Shapes below are pinned against a real captured `codex exec --json` stream (codex-cli 0.143.0):
>    * `thread.started` (carries `thread_id`), `turn.started`/`turn.completed`, and `item.started`/
>    * `item.completed` lines whose `item` is keyed by `item.type` (`agent_message` | `reasoning` |
>    * `command_execution` | `file_change` | `mcp_tool_call` | `web_search`). Only the fields this
>    * adapter reads are declared; usage/token bookkeeping on `turn.completed` is intentionally ignored.
>    */
>   ```
> - **Why:** The comment currently states a fact that is no longer true (Codex is installed) and tells future readers the mapping is unverified. Keep the domain docs honest.

> **Step 7 — Correct the Codex backend entry in the glossary**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:**
>   1. In the "Codex backend" row (Core entities table), replace the sentence beginning "Codex is not installed on this dev machine, so its `thread.started`/`item.*`/`turn.completed` field mapping is best-effort … re-pin once available …" with a note that the mapping is now **pinned against `codex-cli 0.143.0`**, that items are keyed by **`item.type`** (not `item_type`), and that the CLI flag set is `--json --skip-git-repo-check -c sandbox_mode="workspace-write"` — with `resume` sharing that set (it rejects `--sandbox`/`--full-auto`) and differing only by the `resume <thread_id>` positional.
>   2. Bump the `> **Last updated**` line at the top to `2026-07-10` with a one-line summary (e.g. "Codex provider fixed — item mapping re-pinned to `item.type`, resume-safe flags").
>   3. Add a Changelog row:
>      `| 2026-07-10 | Fixed Codex adapter: `item.item_type`→`item.type`, flags → `--json --skip-git-repo-check -c sandbox_mode="workspace-write"` (resume-safe) | Codex chat produced no output (wrong item field) and refused to run in a non-git vault; multi-turn crashed on `--full-auto`/`--sandbox` |`
> - **Why:** `.agents/rules/domain-glossary.md` requires the glossary to track material changes to a domain entity's contract; the current entry actively misinforms.

## Architecture Decisions

**Why a `-c sandbox_mode` config override instead of `--sandbox workspace-write`.** The deprecation warning suggests `--sandbox workspace-write`, and that works on `codex exec`. But `codex exec resume` **rejects** `--sandbox` (`error: unexpected argument '--sandbox' found`). A `-c sandbox_mode="workspace-write"` override is the one form accepted by both subcommands, so first-turn and resume-turn flags stay identical except for the `resume <id>` positional — the smallest, least surprising diff. Confirmed working on both `exec` and `resume`.

**Why not touch the model catalog.** `gpt-5.4-mini` / `gpt-5.5-fast` are intentionally fictional (this is a future-dated project). Codex accepts arbitrary `--model` strings without validation and still returns a response, so the placeholders are not the bug and are left untouched.

**Why not change `src-tauri/src/agent.rs`.** The generic spawner is correct; the bug is purely in how the Codex adapter builds its args and reads item fields. Keeping the fix in the adapter preserves the "only `AgentEvent` leaves this file; the Rust layer stays engine-agnostic" invariant.

**Raw captures backing every decision** (`codex-cli 0.143.0`, run in a non-git dir):

```
# codex exec --json --skip-git-repo-check -c 'sandbox_mode="workspace-write"' "Run 'echo hi' and report output"
{"type":"thread.started","thread_id":"019f4d45-2158-7cb0-864e-33830c62b054"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"Running `echo hi` now…"}}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"/bin/zsh -lc 'echo hi'","aggregated_output":"","exit_code":null,"status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"/bin/zsh -lc 'echo hi'","aggregated_output":"hi\n","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"It output:\n\n```text\nhi\n```"}}
{"type":"turn.completed","usage":{...}}

# reasoning item (with -c model_reasoning_summary=detailed):
{"type":"item.completed","item":{"id":"item_0","type":"reasoning","text":"**Providing a concise answer**…"}}

# without --skip-git-repo-check, in a non-git dir:
Not inside a trusted directory and --skip-git-repo-check was not specified.

# codex exec resume --last --json --sandbox workspace-write …:
error: unexpected argument '--sandbox' found
```

These confirm: item kind lives at `item.type`; the git-repo guard blocks non-git vaults; `resume` rejects `--sandbox`/`--full-auto`. The existing per-item logic (start→`tool_call_start`, completed→`tool_call_result`, `exit_code`/`status` error detection) is otherwise already correct once the field name is fixed.

## Validation Criteria

- [x] `pnpm build` passes (tsc + Vite) — confirms no leftover `item_type` reference and no type errors.
- [x] `pnpm lint` passes.
- [x] `grep -n "item_type\|CODEX_FLAGS\|full-auto" src/lib/agent/backends/codex.backend.ts` returns nothing (all old references gone; one hit is the doc comment explaining why `--full-auto` is unused, not code).
- [ ] **Manual smoke (requires a logged-in `codex` CLI):**
  1. `pnpm dev`, open Settings, select model **GPT 5.4 mini** (engine = Codex).
  2. Send `Hi, what model are you?` → an `agent_message` bubble renders (not an empty/errored turn); the input re-enables after `turn.completed`.
  3. Send a **follow-up** (`And what did I just ask?`) → it answers with context, exercising `codex exec resume <thread_id>` — no "unexpected argument" error, no "exited unexpectedly".
  4. Send `Run the shell command 'echo hi' and tell me the output` → a `ToolChip` appears (running → done) and the final answer includes `hi`, exercising `command_execution` start/result mapping.
  5. Optionally send a prompt that elicits reasoning → a subordinate `ReasoningBlock` renders above the answer.
- [ ] `src-tauri/logs/orbit-111.log` shows the new arg shape, e.g. `args=["exec", "--json", "--skip-git-repo-check", "-c", "sandbox_mode=\"workspace-write\"", "--model", "gpt-5.4-mini", "…"]`.

## Open Questions

- **Sandbox scope.** `workspace-write` lets Codex write within the vault (cwd) — the intended behavior for a note-taking agent. If a future requirement needs Codex to touch files outside the vault, revisit the sandbox mode. No action needed now.
- **Optional stdin hardening (not required).** Codex logs `Reading additional input from stdin...` to stderr because Tauri spawns it with a piped, never-closed stdin. Verified harmless (it does not block, and the adapter ignores stderr). If it ever proves flaky, the clean fix is an opt-in "null stdin" flag on `agent_spawn` that the Codex backend requests — but that touches the shared Rust command and Claude Code's stdin path, so it is deliberately out of scope here.
- **Real vs fictional model ids.** Codex accepts `gpt-5.4-mini`/`gpt-5.5-fast` without error today, so no change is planned. If a specific real Codex model is ever desired, update only `cliModel` in `src/lib/agent/model-catalog.ts` — no adapter change needed.

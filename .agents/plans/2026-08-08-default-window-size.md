# Plan: Default Window Size 1280 × 720

> Status: **completed**
> Created: 2026-08-08
> Updated: 2026-08-08

## Goal

Change the app's default window size from 800 × 600 to 1280 × 720 so orbit-111 opens at a size
that fits its three-region shell (sidebar + viewer + chat) without the user resizing on every
first launch.

## Context

- **Current state:** `src-tauri/tauri.conf.json` declares exactly one window under
  `app.windows[0]` with `"width": 800, "height": 600`. Those are the Tauri defaults left over
  from `create-tauri-app` scaffolding — they were never chosen for this UI.
- **Why it matters:** the shell renders three regions side by side (`Sidebar`, `Viewer`,
  `ChatPanel`). At 800 × 600 the viewer is squeezed the moment both the sidebar and chat are
  open.
- **Nothing else sets the size.** Verified before planning:
  - No `WebviewWindowBuilder` / `WindowBuilder` / `set_size` / `LogicalSize` / `PhysicalSize`
    call exists in `src-tauri/src/**` or `src/**` — `src-tauri/src/lib.rs` builds the app with
    `tauri::Builder::default()` and only registers plugins (`logging`, `opener`, `dialog`,
    `clipboard-manager`).
  - `tauri-plugin-window-state` is **not** a dependency in `src-tauri/Cargo.toml`, so no saved
    geometry overrides the configured value on relaunch.
  - Therefore `app.windows[0]` is the single source of truth, and this is a one-value change.
- **Constraint:** `tauri.conf.json` is compiled into the binary. The new size takes effect on
  the next `pnpm tauri dev` / `pnpm tauri build` — it is not hot-reloaded into a running window.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src-tauri/tauri.conf.json` | Set `app.windows[0].width` / `.height` to 1280 / 720 |

No TypeScript, Rust, test, or glossary changes. `.agents/ubiquitous-language.md` is untouched —
window geometry introduces no canonical entity, state, process, or invariant.

## Step-by-Step Implementation

> **Step 1 — Persist this plan into the repository**
>
> - **File:** `.agents/plans/2026-08-08-default-window-size.md`
> - **Action:** CREATE
> - **Details:** Copy this plan file verbatim into the repo path above. Required because
>   `.agents/rules/plan-creation.md` mandates persistence under `.agents/plans/`, and the plan
>   was drafted while the agent was in read-only plan mode ("Read-Only Plan Mode" clause).
> - **Why:** Keeps the plan discoverable alongside the other 20+ plans in that directory.

> **Step 2 — Update the window dimensions**
>
> - **File:** `src-tauri/tauri.conf.json`
> - **Action:** MODIFY
> - **Details:** In the `app.windows[0]` object, replace the two numeric literals:
>
>   ```diff
>    "windows": [
>      {
>        "title": "orbit-111",
>   -    "width": 800,
>   -    "height": 600
>   +    "width": 1280,
>   +    "height": 720
>      }
>    ],
>   ```
>
>   Change **only** these two values. Do not add `minWidth`/`minHeight`, `resizable`, or
>   `center` — see Architecture Decisions. Keep the surrounding key order and the file's
>   2-space indentation so the diff stays two lines.
> - **Why:** `app.windows[0]` is the sole declaration of the default window geometry; Tauri
>   reads `width`/`height` as logical pixels when creating the window at startup.

> **Step 3 — Re-run the app to pick up the compiled config**
>
> - **Action:** VERIFY (no file change)
> - **Details:** Stop any running dev instance and start a fresh one with `pnpm tauri dev`.
>   `tauri.conf.json` is baked into the binary at build time, so an already-open window keeps
>   its old geometry until the process restarts.
> - **Why:** Prevents a false "the change didn't work" report from a stale running window.

## Architecture Decisions

- **Config over code.** The size is declared in `tauri.conf.json` rather than applied via a
  `WindowBuilder` call in `lib.rs`. Tauri applies the config value before the window is shown,
  so there is no visible resize flash — and it keeps `lib.rs` free of window-geometry logic
  that would then compete with the config as a second source of truth.
- **Logical, not physical, pixels.** Tauri's `width`/`height` config keys are logical pixels,
  so 1280 × 720 renders at the same apparent size on a HiDPI display as on a standard one. No
  scale-factor handling is needed.
- **No `minWidth` / `minHeight` added.** A minimum-size floor for the three-region shell is a
  defensible follow-up, but it is a separate behavioral decision (it would forbid resizes users
  can perform today) and outside this request. Explicitly not done here.
- **No ADR.** Fails all three tests in `.agents/rules/adr.md`: trivially reversible, entirely
  unsurprising, and no real trade-off was made.

## Validation Criteria

- [x] `src-tauri/tauri.conf.json` shows `"width": 1280` and `"height": 720`; `git diff` is
      exactly those two lines.
- [x] The file is still valid JSON — `node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8'))"`
      exits 0.
- [x] `pnpm check` (lint + format) passes.
- [ ] Manual smoke test: `pnpm tauri dev` opens a window measurably wider than before, with
      sidebar, viewer, and chat all comfortably visible; the window is still freely resizable
      and can be shrunk below 1280 × 720.
- [x] No regression run needed for `pnpm test` / `pnpm test:rust` — no TS or Rust source
      changed — but running them costs seconds and confirms the config edit broke no build.

## Open Questions

None.

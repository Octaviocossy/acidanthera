# Plan: Epic — Read View UX

> Status: **draft**
> Created: 2026-09-20
> Issue: #167
> Integration branch: epic/167-read-view-ux

## Goal

Make the read view a surface that can actually be read and worked in: fenced code carries real
syntax colour in both views, the keyboard reaches the surface at all, text scales to the display,
and the mode control stops spending horizontal space on two words.

Source spec: `.agents/specs/2026-09-20-read-view-ux.md` (settled — 6 rounds, 24 decisions).

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #168 | `168-syntax-highlight-fenced-code-in-both-views` | feat: syntax-highlight fenced code in both views | pending |
| 1 | #169 | `169-register-the-two-unregistered-global-commands` | fix: register the two unregistered global commands | pending |
| 1 | #172 | `172-draw-the-view-toggle-as-icons` | feat: draw the view toggle as icons | pending |
| 2 | #170 | `170-add-the-viewer-keymap-layer-with-reading-verbs` | feat: add the viewer keymap layer with reading verbs | pending |
| 3 | #171 | `171-add-content-zoom` | feat: add content zoom | pending |

## Dependency Edges

```
170 -> 169
171 -> 170
171 -> 169
```

Every edge is a shared-artifact dependency rather than a logical one:

- **#170 → #169** — both write `doc/keybindings.md`.
- **#171 → #170** — both write `src/lib/keymap/defaults.ts`, `src/lib/app-command.ts`,
  `src-tauri/src/config.rs` and `src/lib/keymap/seed.ts`.
- **#171 → #169** — both write `src/hooks/use-global-keymap.ts`, and both write
  `doc/keybindings.md`.

#168 and #172 share no source file with the keymap chain or with each other. #168 and #172 both
touch `doc/v0-spec.md` §5.1, but different lines several paragraphs apart, so they are left
independent rather than serialized on a hunk that will merge cleanly.

## Notes for execution

- **Each child promotes its own glossary rows** (ADR 0127) and regenerates
  `.agents/ubiquitous-language-index.md`. Because several children edit the same glossary files,
  expect index regeneration to be the most likely integration conflict — it is generated, so
  re-run `sh .agents/scripts/build-glossary-index.sh .agents/ubiquitous-language-index.md` after
  any merge rather than resolving it by hand.
- **The three ADRs are already on `main`** (0130, 0131, 0132) and are cited, not written, by the
  children.
- **Invariant numbering:** #168 adds **59**, the next free product number — 39–58 are retired and
  never reused. #172 amends 32. No child renumbers anything.
- Acceptance per child is the project's own commands from `AGENTS.md` › Commands: `pnpm check`,
  `pnpm build`, `pnpm test`, plus `pnpm check:rust` / `pnpm test:rust` for #170 and #171, and
  `sh .agents/scripts/verify-scaffold.sh` everywhere the glossary is touched.

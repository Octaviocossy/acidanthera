# Spec: Orbit Design System — adopción y re-skin

> Status: **settled**
> Created: 2026-08-08
> Grilled: 2026-08-08 — 4 rounds, 18 decisions
> Suggested next: /spec-breakdown

## Goal

Adopt the Orbit design system published as Claude Design project `d333dc32` — its token
vocabulary, typography, radius ladder, single AI-only accent, iconography and copy voice — and
re-skin every surface orbit-111 already ships so the app matches the approved mockups
(`Orbit AI Mockups.dc.html`, options 1a–1g). The AI *features* those mockups also depict are
deliberately not built here; three of them are blocked on infrastructure that does not exist.

## Context that shaped the decisions

Three facts, established by inspection rather than assumption, constrained the whole tree:

1. **The mockups are two things at once.** Roughly 40% is a re-skin of surfaces that exist;
   60% is net-new product behaviour.
2. **Three of those features are architecturally blocked.** `src-tauri/Cargo.toml` carries no
   HTTP client, no sqlite, no vector or embedding crate; `reqwest` appears only inside
   `tauri`'s own dependency tree. The single AI path is spawning a CLI: `agent.rs` forwards
   stdout lines it never inspects, and `AgentBackend` is three fire-and-forget methods with no
   deltas, no cancellation token and no request/response correlation. Ghost-text (1b),
   semantic search (1d) and similarity-scored link suggestions (1e) each need a native-provider
   backend that `doc/v0-spec.md` §7 already defers to post-v0.
3. **The design collides head-on with the Factory skin (#55–#60).** Factory ships 3 surfaces,
   3 text levels and *two* accents (orange = live, green = done), and deleted JetBrains Mono in
   #56. Orbit ships 5 surfaces, 4 text levels, *one* ember accent reserved for AI, and makes
   JetBrains Mono the voice of content.

`support.js`, named in the original request, is the generated Design Canvas runtime
(`dc-runtime`) that renders `<x-dc>` documents. It carries no design content. The sources of
truth are the mockup file, `tokens/*.css` and `readme.md`.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | What does "implement the mockups" mean? | Design system + re-skin of existing surfaces, as one epic | Separates what can ship from what is blocked; new AI features become their own spec |
| 2 | Orbit tokens vs. the Factory vocabulary | Orbit names canonical, Factory names as temporary aliases deleted in the final slice | A 5-step surface ladder does not fit in 3; aliases allow slice-by-slice migration instead of one atomic rename (ADR 0006) |
| 3 | Mono typeface and delivery | Self-host `@fontsource-variable/jetbrains-mono`, drop Geist Mono, keep Geist Variable for UI | A desktop app must render offline; the design's own `tokens/fonts.css` uses a Google Fonts CDN import |
| 4 | Themes | Both — midnight dark and parchment light, replacing the Factory light mirror | `data-theme` and `useApplyTheme` already work; light-only tokens get explicit dark values so none falls back to `currentColor` |
| 5 | Window chrome | Adopt it — `titleBarStyle: "Overlay"` + `hiddenTitle`, app-drawn 40px bar | Native traffic lights float over our bar; `--rail-titlebar` was already reserved and unused (ADR 0008) |
| 6 | Where the design system lives | Vendored skill at `.agents/skills/orbit-design/`, **without** a copy of the CSS | One authoritative copy of the values in `src/styles/tokens/`; the skill carries the rules, not a second source of truth |
| 7 | Accent discipline | One ember accent, AI-only. `--accent-metric` (green) retired | The design forbids decorative accent use; `ToolChip`'s done state goes monochrome (ADR 0007) |
| 8 | New primitives | Five: `Kbd`, `SectionLabel`, `Chip`, `Switch`, `Segmented` | Each is already hand-inlined 3+ times; `IconButton`/`Input`/`SidebarItem`/`Tab` are skipped because the last two already exist as store-aware components |
| 9 | Settings dialog | 760px panel with a 3-category rail: Appearance / Editor / Vault | "Intelligence" is omitted — its three switches control out-of-scope features, and an empty tab is worse than no rail |
| 10 | Small structural additions | Sidebar footer, titlebar vault name, status-bar ln/col, model pill in the chat input | All four are presentational or read state that already exists |
| 11 | Geometry and radii | Literal — rails 224/340/40px, ~33px rows, the 8-step semantic radius ladder | New names with old values would leave the system lying about itself |
| 12 | `Button` API break | `kbd:boolean` → `asKbd:boolean`; add `kbd?:string`; variants `primary\|secondary\|ghost`; delete `light` | The rename turns a silent semantic change into a type error at every call site |
| 13 | Empty vault state | Design copy + vault path, no action cards | "Start a daily note" and "Import notes" do not exist, and `v0-spec` §1 states "No onboarding" |
| 14 | Iconography | Vendored 1.2-stroke SVGs + the Unicode glyph vocabulary. No icon dependency | The design's readme asks that any substitution be flagged; adding Lucide for four files is a bad trade |
| 15 | `doc/v0-spec.md` drift | Rewrite §5.6 and correct the three false claims; the rest stays a historical record | The spec's value is documenting the original design; only its style section actively misleads |
| 16 | ADRs | 0006, 0007, 0008 | Each passes the three-part test; the geometry and `Button` decisions do not |
| 17 | Editor re-skin depth | Add a markdown `HighlightStyle` (headings, emphasis, code, links) | No `HighlightStyle` exists today, so markdown renders flat no matter what tokens change |
| 18 | `FileFinder` → palette | 1c chrome (600px, `--radius-panel`, `NOTES` section label, hint footer), no "AI ACTIONS" section | `executeAppCommand` implements 1 of 23 commands and `CommandBar` discards its input — there is nothing for AI action rows to dispatch |

### Deliberate reversal

Decision 10 reintroduces a model selector into the chat surface. The 2026-07-10 changelog
removed `ChatPanel`'s engine selector as redundant with `SettingsDialog`. This is a conscious
reversal, not an oversight: the pill persists through the existing `useChatStore.setModel`,
which already flags `pendingResume` when history exists.

## Explicitly Out of Scope

- **Ghost-text / inline writing assist (1b)**, **semantic search (1d)**, **similarity-scored
  suggested links (1e)** — blocked on the native-provider backend of `v0-spec` §7, not on
  effort. Do not attempt these against the CLI `AgentBackend`.
- **Propose/Apply diff card and context chips (1a)** — buildable, but they change agent
  *behaviour*: the CLIs write the vault directly today (`--allowedTools Read,Write,Edit,…` /
  `sandbox_mode="workspace-write"`) with no channel back into the app. Separate spec.
- **Backlinks (the deterministic half of 1e)** — buildable via a wikilink parser, already on
  the post-v0 roadmap. Not in this epic.
- **Onboarding action cards (1g)** — two of the three are non-existent features, and
  `v0-spec` §1 states the app has one user and no onboarding.
- **The "AI ACTIONS" palette section (1c)** and the **"Intelligence" settings category (1f)** —
  both would surface controls for out-of-scope features.
- **Lucide or any other icon dependency.**
- **Resizable panes.** They do not exist today and the design does not call for them.
- **`--accent-metric` and any non-AI use of the ember accent.** Diff add/delete keep their own
  desaturated colors; that is a distinct job, not decoration.

## Glossary Changes

Added to `.agents/ubiquitous-language.md`: *surface ladder*, *text ladder*, *radius ladder*,
*AI accent*, *titlebar*, the five new primitives (`Kbd`, `SectionLabel`, `Chip`, `Switch`,
`Segmented`), *markdown highlight style*, and the revised `Button` API. The
*Factory signal and metric accents* entry is rewritten. Two invariants added: the ember accent
marks AI agency and nothing else; Factory token names are temporary aliases and new code reads
the Orbit names.

## ADRs Raised

- `.agents/adr/0006-orbit-token-vocabulary.md` — Orbit token names replace the Factory vocabulary
- `.agents/adr/0007-accent-is-ai-only.md` — one ember accent, reserved for AI; the metric green is retired
- `.agents/adr/0008-custom-titlebar-macos-only.md` — app-drawn titlebar, knowingly macOS-only

## Suggested slicing

Eight slices, foundation-first so siblings only add files:

| Slice | Scope | Depends on |
|-------|-------|-----------|
| S1 | Token & type foundation — `src/styles/tokens/*`, both `@theme` blocks, JetBrains Mono, `default_editor_font()` | — |
| S2 | Primitives & iconography — five new `ui/` components, `Button`/`Badge` rewrite, `glyphs.tsx`, vendored SVGs | S1 |
| S3 | Titlebar — `tauri.conf.json`, `capabilities/default.json`, new `Titlebar`, `Layout` | S1 |
| S4 | Sidebar — rail width, row geometry, section label, footer | S1, S2 |
| S5 | Editor — CM theme, markdown `HighlightStyle`, tabs, status bar, empty state | S1, S2 |
| S6 | Chat — panel, messages, input well + model pill, tool chip, history list, FAB | S1, S2 |
| S7 | Overlays — `FileFinder` (1c chrome), `SettingsDialog` (category rail), remaining dialogs | S1, S2 |
| S8 | Cleanup & docs — delete aliases, `--fab-accent*`, `--accent-metric`; `v0-spec` §5.6; vendor the skill | all |

Waves: `1` → `2, 3` → `4, 5, 6, 7` → `8`.

Tests that change knowingly: `Viewer.test.tsx` (pins the literal text `ORBIT`) and the five in
`FileFinder.test.tsx` (overlay structure).

## Residual Unknowns

None. The frontier emptied cleanly.

One risk to carry into implementation rather than a gap in the design: decisions 2 and 7 leave
two token vocabularies live simultaneously until S8. If S8 is dropped or deferred, the repo is
left in a worse state than either endpoint — S8 is not optional polish.

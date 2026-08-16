# Spec: Center the traffic lights on the titlebar

> Status: **settled**
> Created: 2026-08-15
> Grilled: 2026-08-15 — 3 rounds, 8 decisions
> Suggested next: /create-issue

## Goal

Vertically center the native macOS traffic lights on the app-drawn 40px titlebar. Under
`titleBarStyle: "Overlay"` macOS places the buttons for its own ~28pt title bar, so in orbit's
40px bar they sit high — the only element in the bar that is not on the `✦`/`⚙` cluster's
centre line.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Which axis "center" means | **Vertical only** — the buttons' centre line matches the `⚙` glyph's | Horizontal centring collides with the absolutely-centred `orbit — <vault>` title and has no macOS precedent |
| 2 | The horizontal inset `x` | **Leave at the native value** | macOS's default puts the close button's centre on x = 20, which is exactly the *sidebar rail*'s icon column directly beneath it — an alignment worth keeping deliberately rather than breaking by accident |
| 3 | How the `y` literal is settled | **Pin the rule, measure the value** — the spec fixes the centre line, the implementer lands the number against a running window | tao's `y` is the *gap above* the buttons, not their centre, so the literal falls out of the button view's real frame height. A constant that is 6px off is invisible in a diff and wrong on screen |
| 4 | The unused `--mac-*` colour tokens | **Delete all three** | `--mac-red`/`--mac-yellow`/`--mac-green` are read nowhere in `src/` and imply the app draws the lights, which ADR 0008 refused. They are a false signal aimed at exactly the reader this work creates |
| 5 | 40px living in both CSS and native config | **Accept the duplication**; record the coupling in the glossary | Not a real trade-off in the end: tauri 2.11.5 exposes no runtime setter at all (see Facts), so static config is the only supported mechanism |
| 6 | The `decorations` dependency | **Spell out `"decorations": true`** beside `titleBarStyle` | `trafficLightPosition` silently no-ops without it, and JSON carries no comment to warn. A future `decorations: false` — the exact thing ADR 0008 says someone will reach for — would break the centring with no error |
| 7 | Whether to raise an ADR | **No ADR** | Fails two of `adr.md`'s three tests: a two-line config edit is not hard to reverse, and there was no competing mechanism to trade off against. ADR 0008 already owns the durable ruling this tunes |
| 8 | Routing | **`/create-issue`** | One self-contained change, tracked like every comparable change in this repo; the measure-it-in-a-running-window criterion needs a durable home |

## Facts Established

Verified against the resolved dependency set (`tauri-2.11.5`, `tauri-utils-2.9.3`,
`tauri-runtime-2.11.3`, `tauri-runtime-wry-2.11.4`, `tao-0.35.3`, `@tauri-apps/api` 2.11.1).
These are lookups, not decisions, and they are what closed decisions 3, 5 and 6.

- **The config field exists.** `WindowConfig.traffic_light_position: Option<LogicalPosition>`
  (`tauri-utils-2.9.3/src/config.rs:2060`), default `None`, serialized `trafficLightPosition`,
  `LogicalPosition { x: f64, y: f64 }`. Doc comment: *"Requires titleBarStyle: Overlay and
  decorations: true."*
- **There is no runtime alternative.** `Dispatch::set_traffic_light_position` exists at the
  runtime layer down to tao's `set_traffic_light_inset`, but tauri 2.11.5 exposes **no** public
  `Window`/`WebviewWindow` method, **no** IPC command, **no** ACL permission (`grep -i traffic`
  over all four files in `src-tauri/gen/schemas/` returns 0 hits), and **no** JS function
  (`@tauri-apps/api` ships only the *type*, `window.d.ts:1663`). `Dispatch` is reachable only
  through the sealed `ManagerBase`.
- **Position semantics.** In tao's `inset_traffic_lights`, `x` is the close button's frame-origin
  x and `y` is the **gap above** the buttons; the native title-bar container view is reframed to
  `button_height + y`.
- **No fullscreen handling needed.** tao stores the inset on the view state and re-applies it in
  `draw_rect`, so the reset-after-fullscreen problem that afflicts one-shot runtime calls does
  not arise on the static path.

## Affected Surfaces

Named for the issue's benefit; the step-by-step belongs in the plan, not here.

- `src-tauri/tauri.conf.json` — add `decorations` and `trafficLightPosition` to the `main` window.
- `src/styles/tokens/colors.css` — delete `--mac-red`, `--mac-yellow`, `--mac-green` and their
  `/* Traffic lights (11px circles) */` comment.
- `.agents/ubiquitous-language.md` — already amended by this session (see Glossary Changes);
  the implementer removes the Cross-cutting section marker when the change lands.

## Verification

- The buttons' centre line matches the `⚙` glyph's in a running window. This is a **measured**
  check — screenshot `pnpm tauri dev`, do not accept a guessed literal.
- The `✦` and `⚙` buttons still respond to clicks, and `data-tauri-drag-region="deep"` still
  drags the window. Rationale: setting the inset reframes the native title-bar container to
  `button_height + y`. At a centred `y` that container should be *smaller* than today's default,
  so this is expected to pass untouched — but a container that grew would silently intercept the
  top-right chrome, and that failure mode is invisible without a hands-on check.
- The close button's centre still sits on x = 20, over the *sidebar rail*'s icon column.
- `pnpm check` and `pnpm build` pass.

## Explicitly Out of Scope

- **Horizontal repositioning of the cluster.** Refused in decision 1.
- **Any change to the window title, the `✦`/`⚙` cluster, or the drag region.** They are already
  on the correct centre line; the lights move to meet them.
- **A reserved left-hand "traffic light zone" in `Titlebar`.** Nothing is rendered on the left
  today; building for a hypothetical collision is not warranted.
- **Runtime repositioning, and any new ACL permission.** No supported API exists (see Facts),
  and reaching the raw `NSWindow` to work around that is disproportionate to centring three
  buttons.
- **Non-macOS platforms.** ADR 0008 stands unchanged — `trafficLightPosition` is macOS-only and
  is documented Unsupported on Linux/Windows/iOS/Android.
- **Persisting or making the titlebar height configurable.** `--rail-titlebar` stays a constant.

## Glossary Changes

Written inline during the session, in `.agents/ubiquitous-language.md`:

- **Added** *traffic light inset* (`app.windows[].trafficLightPosition`) — placement is native
  config and never CSS; the `y` literal's duplication of `--rail-titlebar`'s 40px; the `x = 20`
  alignment with the *sidebar rail*'s icon column; the explicit `decorations: true`.
- **Amended** *titlebar* — points at *traffic light inset* for the buttons' vertical placement.
- **Added** a marker to the Cross-cutting presentation section, removed when this lands.
- **Added** a Changelog row dated 2026-08-15.

## ADRs Raised

None. Decision 7 weighed and declined one.

## Residual Unknowns

None. The frontier emptied cleanly. The `y` literal is deliberately unspecified rather than
unknown — decision 3 makes measuring it part of the implementation.

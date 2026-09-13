# The chrome strip admits controls

ADR 0121 dissolved the titlebar into per-region *chrome strips* and ruled that the strip
"carries no state and no controls" — it exists for the native traffic lights and the drag
region, and every global control lives in the sidebar. The navigation history added by the
2026-09-09 home-surface work puts its back/forward pair in the sidebar's strip, so that clause
no longer holds and is amended here rather than quietly broken.

The rule it is replaced by: the strip carries **no state**, and the only controls it may carry
are those that act on *what the window is currently showing* rather than on the app. Back and
forward qualify; a settings gear, a theme toggle, and a create action do not — they stayed in
the sidebar, which is why ADR 0121's substance survives this. The narrower rule is what keeps
the strip from drifting back into a titlebar one convenience at a time.

## Considered Options

- **Put the pair in the brand row instead**, leaving ADR 0121 untouched. Rejected: the brand
  row is a 224px cluster already holding find, collapse and settings, and navigation is not a
  vault-explorer action — filing it there would make the row mean two things.
- **Refuse navigation history.** This was the recommendation at the design interrogation and it
  was declined; the feature is wanted.

## Consequences

- Invariant 23 is amended: "the chrome strip carries no state and no controls at all" becomes
  "carries no state, and only controls that act on the current view".
- The strip is `data-tauri-drag-region="deep"`, so the two controls rely on Tauri's
  clickable-tag exemption exactly as the editor tabs already do.
- The pair is expanded-sidebar only. At 40px the rail has no room, and unlike the gear
  (ADR 0121 decision 30) a navigation control with no visible destination is not worth a
  tooltip-identified 40px glyph.

# The app draws its own titlebar, knowingly macOS-only

Every approved mockup draws a 40px bar carrying the traffic lights and `orbit — <vault>`, and
it is the single largest reason the design reads as a different application. We adopt it with
`titleBarStyle: "Overlay"` + `hiddenTitle` rather than `decorations: false`, so macOS keeps
drawing real, correctly-behaved traffic lights and the app draws only the bar beneath them.
`--rail-titlebar` already existed in `rails.css`, declared and consumed nowhere — it was
reserved for exactly this.

`titleBarStyle` is a macOS-only option. On Windows and Linux the native title bar remains, so
the app would show a doubled bar until the component is conditionally rendered. We accept that
asymmetry deliberately: `doc/v0-spec.md` §1 scopes this project to a single user on macOS, and
paying cross-platform chrome costs before there is a cross-platform user is the wrong trade.

## Consequences

The change is not confined to `tauri.conf.json`. `src-tauri/capabilities/default.json` grants
no window permissions beyond whatever `core:default` covers, so anything that programmatically
moves, resizes or decorates the window needs an explicit permission added there. A future
Windows or Linux target must gate the `Titlebar` component on platform, not delete it.

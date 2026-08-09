# The sidebar context menu is app-drawn

The sidebar's right-click menu is an absolutely-positioned React overlay mounted in `Layout`, not
a native OS menu popped from Rust via `tauri::menu::Menu::popup`. A native menu cannot carry the
Orbit token vocabulary, cannot be tested in jsdom, and needs a two-language round trip per action;
an app-drawn one reuses the overlay idiom every other dismissable surface in the app already
follows.

Note this cuts the opposite way from ADR 0008, which kept the *native* macOS traffic lights
precisely for native behavior. The distinction is that window chrome must behave like the
platform's, whereas a menu listing this app's own commands is content.

## Consequences

The menu must mount in `Layout`, never inside `Sidebar` — the sidebar body is `overflow-y-auto`
and `Layout`'s row is `overflow-hidden`, so a menu rendered in place would clip. Positioning and
viewport clamping become ours to own, as does dismissal on scroll and window blur, which a native
menu would have handled.

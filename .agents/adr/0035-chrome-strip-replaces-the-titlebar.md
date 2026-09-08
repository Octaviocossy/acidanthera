# The titlebar dissolves into per-region chrome strips

The app drew a 40px full-width `Titlebar` above the sidebar/viewer/chat row, carrying the window
title, the drag region, and the `✦`/`⚙` cluster. The unified-sidebar design removes all three
passengers — the title is redundant once the vault name sits in the sidebar footer, `✦` becomes a
primary-nav row, and `⚙` a footer control — leaving a bar containing nothing but the traffic
lights. We delete the component and give each region its own 40px top strip instead: the sidebar
renders a bare drag strip the native traffic lights sit on, and `EditorTabs` becomes the viewer's,
reserving its height even at zero buffers. The band is called the **chrome strip**;
`--rail-titlebar` keeps its name, having outlived the component it was named for.

## Considered Options

A single spanning component with a left segment painted like the sidebar was the obvious
alternative. Rejected because it would have to track `--rail-sidebar` itself to keep the seam
aligned through expand and collapse — restating in a second place a width the sidebar already
owns.

## Consequences

`trafficLightPosition` is static config with no runtime setter in tauri 2.11.5, so the lights
cannot move when the sidebar collapses to 40px and would overflow the rail. The viewer's strip
therefore insets its left edge by `max(0, lights width − sidebar width)`, which is zero whenever
the sidebar is expanded. The drag region moves onto **both** strips rather than one, because in
the collapsed state the sidebar's own strip has nothing left to grab.

This finishes what ADR 0011 began against ADR 0009: the titlebar is no longer one of two
always-visible chrome hosts, it is none of them. Every global control now lives in the sidebar,
which is why the collapsed rail had to grow `✦` and `⚙` — ADR 0011 decisions 18 and 20 are both
amended by this.

ADR 0008 stands. The app still draws its own chrome and is still knowingly macOS-only; what
changes is that the chrome is no longer a bar.

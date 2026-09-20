# Zoom scales content, not the window

Zoom scales note content only — the editor's text and the read view's prose — and leaves every piece
of chrome at its authored size. The obvious implementation, a webview-level zoom, is unavailable
rather than merely undesirable: it would scale the 40px chrome strip while the native macOS traffic
lights sitting on it do not scale, so `TRAFFIC_LIGHT_CLEARANCE` would desync and the custom chrome
would drift out from under the window controls at every level but 100%.

Scaling the whole `--font-size-*` ladder instead was the remaining alternative, and was rejected as
answering a question nobody asked: someone who wants a note bigger does not want the tabs, the rail
and the dialogs bigger too.

## Consequences

Anyone expecting the platform convention — that zoom grows the application — will find it does not,
which is the surprise this record exists to explain. The editor's `28px 36px` padding, the read
view's `max-w-[680px]` measure and its `px-9 py-7` do not scale with the type, so the measure holds
proportionally fewer characters as the level rises; 1.6 is the upper bound for that reason.

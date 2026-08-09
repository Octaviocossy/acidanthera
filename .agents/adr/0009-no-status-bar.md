# orbit has no status bar

Editor state renders inside the editor and global controls live in the titlebar; there is no
bottom bar. The 24px `StatusBar` had accumulated six unrelated passengers — a region name the
focus border already showed, a cursor readout belonging to the editor, a sidebar toggle
belonging to the sidebar, a duplicated settings entry, a `GlobalMode` badge indistinguishable
from the editor's vim badge, and `find`, which had no other home. Rather than curate the bar we
deleted it and rehomed each passenger to the surface that owns it.

## Consequences

The titlebar stops being a passive label and becomes the app's only always-visible chrome host.
That is what makes the sidebar's own collapse button viable: `closeSidebar` unmounts `Sidebar`
entirely, so a control inside it can only ever hide — the titlebar's re-show control, rendered
only while the sidebar is hidden, is what closes that one-way door.

The cost is discoverability. A labelled bar advertises `FIND` and `SETTINGS` in words; icon
controls in a 40px titlebar and an unlabelled `ln · col` cluster do not. We accept that: the app
is keyboard-first, every affordance keeps its `Ctrl-w` chord, and the accessible names carry the
labels the pixels no longer do.

The next contributor's instinct on wanting to surface some new piece of state will be to add a
status bar back. That is the reflex this record exists to interrupt — new state goes on the
surface that owns it, or it does not get shown.

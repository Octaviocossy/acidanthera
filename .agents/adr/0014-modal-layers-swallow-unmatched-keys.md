# Modal layers swallow unmatched keys

The shared keymap dispatcher skips a layer whose trie has no match and tries the next one, so
region chords stayed live underneath every dialog's scrim — with a dialog open, `activeRegion` is
still `'sidebar'` and `j` / `k` / `a` / `A` all dispatch behind it. Rather than give each dialog
its own `stopPropagation`, the `modal` layer now sits first in `LAYER_PRECEDENCE` and, while
active, absorbs every keydown — matched or not — so no lower layer runs under an overlay. This
finally gives `resolved.layers.modal` and `applyModalLockoutGuard` a consumer; both were built in
#97 and never connected.

## Consequences

`CloseBufferDialog`, `SwitchVaultDialog` and `SettingsDialog` still hardcode their own dismissal
and still leak region chords. That is deferred, not missed: retrofitting them means touching three
components unrelated to the work that introduced the layer. Until they are converted, the app has
two dismissal idioms at once, and only overlays registering the `modal` layer are actually modal
with respect to the keyboard.

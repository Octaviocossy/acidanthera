# The viewer region gains a keymap layer

The `viewer` focus region was the only one carrying no keymap layer: `LAYER_PRECEDENCE` held
`modal`, `sidebar`, `chat.history` and `global`, while `editor` was excluded on purpose because
CodeMirror wins its keys by DOM propagation order before the dispatcher runs. That left the read
view with no verbs at all — its `<article>` is not an editable target, so the dispatcher saw every
keydown and matched none of them — and left the region concept paying its cost without collecting
its benefit. We add `viewer` as a fifth layer, between `chat.history` and `global`, active only
while the read view is showing.

The alternative was an `onKeyDown` on `ReadView`. It is fewer pieces and touches no shared code, but
it makes `j`, `k` and `G` string literals that `keymaps.toml` cannot rebind — a fourth dispatch path
outside the system ADR 0103 and the keymap resolver exist to keep single. The layer costs one entry
in the precedence list and buys the read view the same rebindable verbs every other region already
has.

## Consequences

The layer does **not** swallow; only `modal` does (ADR 0112), so a chord the viewer does not claim
still falls through to `global`. It activates in the read view only and not on the home surface,
whose rows are a selection model rather than a scroll one and would need a cursor this layer does
not provide. And the read view remains **not** a fourth focus region (invariant 20) — this adds a
layer to an existing region, not a region.

The seven verbs — six scroll motions plus `viewer.save` — are dispatched from the layer's own
closures rather than through `executeAppCommand`'s shared switch (#170): the scroll verbs need the
live scroll container, which only the hook holds (`viewer-scroll-container.ts`), and splitting
`viewer.save` out to dispatch through the switch while its six siblings stay in the hook would make
one of seven verbs inconsistent with the rest for no reason. `viewer.save` reaches the same
`EditorSaveRequest` lifecycle `editor.save` already uses — there is still exactly one save path,
never a second one scoped to the read view.

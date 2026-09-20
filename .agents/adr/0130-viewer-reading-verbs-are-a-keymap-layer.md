# The viewer's reading verbs are a keymap layer, not a handler

The read view had no way to scroll with `j`/`k`/`gg`/`G`/`Ctrl-d`/`Ctrl-u`, and no way to save a
checkbox edit at all (issue #170): `viewer` sat in `LAYER_PRECEDENCE` with no layer registered for
it, so only `global` ever matched a keydown there. A `ReadView`-local `onKeyDown` would have been
fewer moving pieces, but it makes `j`, `k` and `G` literal strings `keymaps.toml` cannot see or
rebind, and adds a fourth independent dispatch path outside the shared window dispatcher ADR 0103
exists to keep singular. Instead, `viewer` becomes a fifth `KeymapLayer` — `useViewerKeymap`
contributes it through `useDispatcherLayer` exactly like `useSidebarKeymap` and
`useChatHistoryKeymap` already do, and `LAYER_PRECEDENCE` gains it just above `global` so its bare
letters win there without out-ranking the other region layers.

## Consequences

The layer never sets `swallows` — invariant 25 reserves that for `modal` alone — so a chord it does
not claim, such as `Ctrl-w b`, still falls through to `global` from the read view exactly as it
does everywhere else. It is scoped to the *read view* specifically, not the whole viewer region:
the *home surface* has no scroll container and no cursor model, so `j`/`k` there would need to mean
something this issue does not build (a selection model), and the layer's own activation predicate
excludes it rather than special-casing an inert scroll. The seven verbs — six scroll motions plus
`viewer.save` — are dispatched from the hook's own closures rather than through
`executeAppCommand`'s shared switch: the scroll verbs need the live scroll container, which only
the hook holds (`viewer-scroll-container.ts`), and splitting `viewer.save` out to dispatch through
the switch while its six siblings stay in the hook would make one of seven verbs inconsistent with
the rest for no reason. `viewer.save` reaches the same `EditorSaveRequest` lifecycle
`editor.save` already uses — there is still exactly one save path, never a second one scoped to the
read view.

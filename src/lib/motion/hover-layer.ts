/**
 * The pointer-only hover for a list row whose keyboard cursor must stay instant (decision 19,
 * ADR 0133): an opaque `--bg-hover` layer, one surface step up, whose opacity is the only thing
 * that transitions. The host adds `relative isolate`, keeps its cursor and active states on its own
 * untransitioned background, and adds `before:hidden` wherever that background must win.
 */
export const POINTER_HOVER_LAYER =
  'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-item before:bg-hover before:opacity-0 before:transition-opacity before:duration-[var(--dur-fast)] before:ease-acidanthera hover:before:opacity-100';

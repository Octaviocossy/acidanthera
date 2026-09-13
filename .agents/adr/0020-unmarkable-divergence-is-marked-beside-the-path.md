# A divergence the sync cannot mark in place is marked beside the path

A scaffold-owned path that has diverged but cannot hold text — a symlink, a directory, anything
that is not a regular file — gets its conflict written **beside** it, in `<path>.scaffold-conflict`,
as the same marker block an in-file conflict gets (each side the file's content where that side is
a regular file, one line such as `symlink -> <text>` or `directory` otherwise), and is recorded in
the sync baseline with the same `conflict` flag. Deleting the sidecar once the path is fixed is the
resolution signal, exactly as removing the markers is for a file; a sidecar whose path is identical
to the source again is litter the sync removes itself.

ADR-0019 chose in-file markers over "a sidecar diff", and this does not reverse it: the sidecar is
not a diff and not the general mechanism, it is the marker artifact moved next to the one class of
path that cannot contain it. Before this, such a divergence was counted, printed once, and left
nowhere — no marker for `resolving-scaffold-sync` to find and no baseline entry, so it could never
end. The three symlinks the scaffold ships were in that class by construction.

## Considered Options

- **Baseline entry only, no artifact.** Rejected: nothing then signals that a human acted, so the
  next run must either bless the divergence unseen or conflict forever; and discovery would need a
  second channel beside the grep every in-file conflict already answers to.
- **Replace the link with a regular marker file at the same path.** Rejected: it covers a symlink
  but not a directory, so directories would need the sidecar anyway — two mechanisms for one
  outcome — and it forces the resolver to know how to rebuild a link.
- **Restore the scaffold's link automatically.** Rejected: the sync detects and never resolves; a
  re-pointed link carries an intent, and silently replacing it is the overwrite ADR-0019's
  invariant exists to forbid.

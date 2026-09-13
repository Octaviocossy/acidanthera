# /install-scaffold syncs instead of skipping

`install-scaffold.sh` no longer leaves every pre-existing file untouched. On a re-run it
implements what the target lacks and merges what it must; where a scaffold-owned artifact and the
project's copy have genuinely diverged it writes conflict markers and stops, and the
`resolving-scaffold-sync` skill resolves them.

This reverses a guarantee the command documented — *"safe to run repeatedly: any file that
already exists in the target is left untouched"* — so it is recorded rather than discovered. That
guarantee made the copier safe and also made it a one-way door: no correction to any scaffold-owned
file could ever reach a project after installation, which is the gap ADR-0017 splits the glossary
to close. Skipping is only safe when the scaffold never changes.

Conflict markers were chosen over a sidecar diff because they are the artifact a resolving
procedure is built to read, they need no git in the target — which may not be a repository — and
they keep the copier POSIX `sh` with no dependencies. Resolution is delegated to a **sibling**
skill rather than to `resolving-merge-conflicts`, whose body is vendored and four of whose five
steps assume a real git merge that a scaffold sync does not have (ADR-0003).

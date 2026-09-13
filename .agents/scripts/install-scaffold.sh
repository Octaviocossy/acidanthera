#!/bin/sh
# install-scaffold.sh — manifest-driven sync for the cross-agent governance scaffold.
#
# Usage: install-scaffold.sh [target-dir]
#
# Reads .agents/scaffold.manifest relative to this script's own repo root (resolved from
# the script's own path, so it works whether run in-place or from a cloned/degit'd copy)
# and brings every listed file/directory in target-dir up to date with this one.
#
# ## Sync, not copy-or-skip (ADR-0019)
#
# This script used to leave every destination that already existed untouched. That made it
# safe and made it a one-way door: no correction to a scaffold-owned file could ever reach a
# project after installation. It now syncs, and every entry lands in one of six outcomes:
#
#   created    the destination did not exist
#   updated    the destination still held the state the two sides last agreed on, and the
#              scaffold has moved on — so it is overwritten
#   unchanged  the destination is identical to the source, or neither side has moved since
#              they last agreed
#   resolved   a conflict this script wrote has been resolved: the markers are gone, so the
#              destination becomes the new agreed state
#   skipped    the destination diverges and the entry is project-owned
#   conflict   the destination diverges and the entry is scaffold-owned — the target has edited a
#              file it does not author — so the destination is rewritten with conflict markers,
#              or, for a path that cannot hold text, a conflict sidecar
#              <path>.scaffold-conflict is written beside it, and the run exits non-zero — or, for
#              a path beneath an ancestor that is not a real directory, refused unread: no marker,
#              no sidecar, no baseline entry, since writing anything there would write through the
#              ancestor
#
# ## Ownership is declared, never inferred
#
# Who wins a divergence is declared in the manifest by `# @owner scaffold` / `# @owner project`
# directives, each applying until the next one. Unclassified entries default to project-owned,
# whose behavior is exactly the old skip, so nothing can regress into being overwritten.
#
# ## The sync baseline
#
# "Updated" and "conflict" are the same observation — destination differs from source — and can
# only be told apart by knowing what the two sides last agreed on. So the baseline records two
# digests per path, in <target>/.agents/scaffold.baseline: what the scaffold last delivered, and
# what the destination looked like when the two last agreed. A destination still at that agreed
# state is one the target has not touched, so a scaffold-side change is simply delivered; a
# destination that has moved away from it is the target's edit, and only a human can reconcile it.
#
# Two digests rather than one because a single one cannot tell "the human resolved the conflict"
# from "the human edited a scaffold-owned file" — both leave the destination differing from the
# source. Hence the third field: an entry is flagged `conflict` while markers this script wrote —
# in the file, or in a sidecar beside it — are outstanding, and once they are gone the destination
# is accepted as the new agreed state.
# That is what lets a resolution stabilize: a correctly resolved file reports `unchanged` and
# exits 0 forever after, rather than conflicting again on every run.
#
# Where no baseline entry exists — a target installed by the old copier, or a line this script
# cannot parse — it cannot prove a scaffold-owned file is untouched, so it conflicts rather than
# overwrite. Commit the baseline file: a clone of the project without it conflicts on every file
# the scaffold has changed since.
#
# ## Comparing: exactly for the decision, by digest for the record
#
# Whether the destination is identical to the source is decided with `cmp -s` (link text for a
# symlink, which cmp cannot follow safely) — exact, and it stops at the first differing byte. The
# baseline cannot store whole files, so it stores a digest: SHA-256 where the target has a tool
# for it, falling back to `cksum` where it does not, keeping the script POSIX sh with no new hard
# dependencies (ADR-0019).
#
# ## Conflict granularity: whole file, deliberately
#
# Markers wrap the entire file rather than a smaller unit. POSIX sh has no merge engine and no
# way to align two texts, and a row-level merge that mis-aligns silently is worse than a coarse
# one a human resolves. The `resolving-scaffold-sync` skill is the procedure that resolves them;
# this script only detects. A conflicted sync exits non-zero — a half-applied install that
# reports success is how a broken tree gets committed.
#
# ## Conflict sidecar (ADR-0020)
#
# One class of path cannot hold that block at all: a symlink (writing into it writes through to
# whatever it points at), a directory, a device node. The three symlinks the scaffold ships are in
# it by construction. For those the same block is written *beside* the path instead, as
# <path>.scaffold-conflict — each side the file's content where that side is a regular file, one
# descriptive line otherwise. It is the marker artifact moved, not a second mechanism: the grep
# that finds an in-file conflict finds it too, its presence means outstanding exactly as markers
# do, and deleting it once the path itself is fixed is the resolution signal. A sidecar left
# beside a path that is identical to the source again is this script's own litter, and this
# script collects it.
#
# ## Containment
#
# Every write and delete above lands beneath the target root, and the invariant holds for every
# component beneath it, not only the last one. A path whose ancestor is a symlink — wherever it
# points — or a regular file where a directory should be is refused before it is read: no marker,
# no sidecar, no baseline entry, since anything written there would be written through that
# ancestor. `.agents` is checked once up front, because the baseline lives there and no agreement
# can be recorded through a link; every other ancestor refuses only its own subtree. The target
# root itself is never checked — it is wherever the user pointed. Nothing is resolved, only
# refused: no realpath, readlink -f, cd -P or pwd -P.
set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)
source_root=$(cd "$script_dir/../.." && pwd)
manifest="$source_root/.agents/scaffold.manifest"
target_dir=${1:-.}
[ -n "$target_dir" ] || target_dir="."

if [ ! -f "$manifest" ]; then
  echo "error: manifest not found at $manifest" >&2
  exit 1
fi

mkdir -p "$target_dir"
target_dir=$(cd "$target_dir" && pwd)

# The baseline lives in .agents, so that one directory is checked once, up front: no agreement can
# be recorded through a link, and a run that cannot record its agreement has no coherent outcome
# to report. Missing is fine — the mkdir -p at the end of the run creates it, as today. Present
# and not a real directory is refused before anything anywhere is written.
agents_dir="$target_dir/.agents"
if [ -L "$agents_dir" ] || { [ -e "$agents_dir" ] && [ ! -d "$agents_dir" ]; }; then
  echo "error: $agents_dir is not a directory. The sync records its baseline there and never writes through a symlink: replace it with a real directory, or sync the directory it points at as its own target." >&2
  exit 1
fi
baseline="$target_dir/.agents/scaffold.baseline"

file_list=$(mktemp "${TMPDIR:-/tmp}/scaffold-manifest.XXXXXX")
new_baseline=$(mktemp "${TMPDIR:-/tmp}/scaffold-baseline.XXXXXX")
scratch=$(mktemp "${TMPDIR:-/tmp}/scaffold-scratch.XXXXXX")
trap 'rm -f "$file_list" "$new_baseline" "$scratch"' EXIT

tab=$(printf '\t')
nl='
'

# Digest of stdin, for the baseline record only — never for deciding whether two files are
# identical, which is `same` below. Collision resistance matters here because the record is what
# a later run trusts when it decides a file is untouched, so prefer SHA-256 wherever the target
# has it and fall back to cksum (CRC32 + byte count) only where it does not.
if command -v shasum >/dev/null 2>&1; then
  hash_stdin() { shasum -a 256 | awk '{ print "sha256:" $1 }'; }
elif command -v sha256sum >/dev/null 2>&1; then
  hash_stdin() { sha256sum | awk '{ print "sha256:" $1 }'; }
elif command -v openssl >/dev/null 2>&1; then
  hash_stdin() { openssl dgst -sha256 | awk '{ print "sha256:" $NF }'; }
else
  hash_stdin() { cksum | awk '{ print "cksum:" $1 "-" $2 }'; }
fi

# A path's identity for the record: its content for a regular file, its link text for a symlink
# (a symlink has no content to merge — following it would compare, and later overwrite, whatever
# it points at). Anything else — a directory in the way, a device node — is recorded as the one
# coarse state `x:none`, which does equal itself: two such states are indistinguishable, so a
# directory the two sides once agreed on can report `unchanged` (the scaffold has not moved) or
# conflict (it has), but never `updated` — delivering over a directory is forbidden outright.
digest() {
  if [ -L "$1" ]; then
    readlink "$1" | hash_stdin | sed 's/^/l:/'
  elif [ -f "$1" ]; then
    hash_stdin < "$1" | sed 's/^/f:/'
  else
    printf 'x:none\n'
  fi
}

# Exact identity, byte for byte. cmp(1) would follow a symlink to whatever it points at, so a
# link is compared by its text instead; a path that is neither a regular file nor a symlink is
# never identical to anything.
same() {
  if [ -L "$1" ] || [ -L "$2" ]; then
    [ -L "$1" ] && [ -L "$2" ] && [ "$(readlink "$1")" = "$(readlink "$2")" ]
  elif [ -f "$1" ] && [ -f "$2" ]; then
    cmp -s "$1" "$2"
  else
    return 1
  fi
}

# Every ancestor of a destination must be a real directory of the target — not a symlink (wherever
# it points), not a regular file where a directory should be. A missing one is fine: deliver's
# mkdir -p creates it. Nothing is resolved, only refused: no realpath, readlink -f, cd -P or
# pwd -P — the sync has no business following a link to find out where it goes, and an in-target
# alias is still a write through a symlink. The target root itself is never checked; it is
# wherever the user pointed. Sets `offender` to the first offending component, relative to the
# target, and returns non-zero.
contained() {
  contained_rel=$1
  offender=''
  contained_walk="$target_dir"
  contained_rest=${contained_rel%/*}
  [ "$contained_rest" != "$contained_rel" ] || return 0   # leaf at the root: no ancestors
  while [ -n "$contained_rest" ]; do
    contained_head=${contained_rest%%/*}
    contained_walk="$contained_walk/$contained_head"
    # -L first: -d follows symlinks, so a link to a directory passes -d and must be caught ahead
    # of it.
    if [ -L "$contained_walk" ] || { [ -e "$contained_walk" ] && [ ! -d "$contained_walk" ]; }; then
      offender=${contained_walk#"$target_dir"/}
      return 1
    fi
    [ "$contained_rest" != "$contained_head" ] || break
    contained_rest=${contained_rest#*/}
  done
  return 0
}

# The baseline entry for a path, into prev_src / prev_dest / prev_flag, all empty when the path
# has no entry. A line this script cannot parse — including one written in the single-digest
# format that predates this — is treated as absent rather than trusted or fatal.
read_baseline() {
  prev_src=''
  prev_dest=''
  prev_flag=''
  [ -f "$baseline" ] || return 0
  found=$(awk -F"$tab" -v want="$1" '
    /^#/ { next }
    NF == 4 && $1 == want && ($4 == "-" || $4 == "conflict") { print $2, $3, $4; exit }
  ' "$baseline")
  [ -n "$found" ] || return 0
  prev_src=${found%% *}
  found=${found#* }
  prev_dest=${found%% *}
  prev_flag=${found##* }
}

# One entry for the next run: the path, what the scaffold delivered, what the destination looked
# like when the two last agreed, and whether markers are still outstanding.
remember() {
  printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" >> "$new_baseline"
}

# Markers an earlier sync wrote and nobody has resolved yet. Re-marking such a file would nest
# one conflict inside another; reporting it keeps an unresolved tree from ever exiting 0.
#
# Any one marker is enough. Removing the scaffold side of a conflict means deleting its header
# and its body, and stopping one line short of `=======` or `>>>>>>> project` is an ordinary
# half-resolution — one that, if this looked for the opening marker alone, would be accepted as
# resolved and then blessed into the baseline, so every later sync reports the corruption
# `unchanged` forever.
#
# Deliberately no bare `^=======$` test: that separator is indistinguishable from a Markdown
# setext heading underline, and this script installs into other people's documents, where a false
# positive would report a permanent conflict with no marker to remove. The two angle-bracket
# markers are distinctive on their own, and a resolution that removed both of them has left
# nothing identifiable as a marker anyway.
has_markers() {
  [ -f "$1" ] && [ ! -L "$1" ] &&
    grep -q -e '^<<<<<<< scaffold$' -e '^>>>>>>> project$' "$1"
}

# cat(1) plus the trailing newline the file may be missing, so the next marker line starts on
# a line of its own instead of being glued to the last line of content.
cat_nl() {
  cat "$1"
  if [ -s "$1" ] && [ -n "$(tail -c 1 "$1")" ]; then
    printf '\n'
  fi
}

write_conflict() {
  conflict_src=$1
  conflict_dest=$2
  {
    printf '<<<<<<< scaffold\n'
    cat_nl "$conflict_src"
    printf '=======\n'
    cat_nl "$conflict_dest"
    printf '>>>>>>> project\n'
  } > "$scratch"
  # Written through the existing file rather than moved over it, so the destination keeps its
  # inode and mode — and so the read of the destination above completes before it is replaced.
  cat "$scratch" > "$conflict_dest"
}

# The conflict sidecar: where a divergence lands when the path itself cannot hold markers — a
# symlink (writing into it would write through to its target), a directory, a device node. The
# same three-marker block, written beside the path instead of into it (ADR-0020). Its presence
# means "outstanding", exactly as in-file markers do; deleting it is how a human resolves it.
sidecar_of() {
  printf '%s.scaffold-conflict' "$1"
}

has_sidecar() {
  [ -f "$(sidecar_of "$1")" ] && [ ! -L "$(sidecar_of "$1")" ]
}

# One side of a sidecar: the content where the side is a regular file (so the resolver can drop a
# scaffold file straight into place), one descriptive line otherwise — there is nothing else to
# show for a link but where it points, or for a directory but that it is one.
describe_side() {
  if [ -L "$1" ]; then
    printf 'symlink -> %s\n' "$(readlink "$1")"
  elif [ -f "$1" ]; then
    cat_nl "$1"
  elif [ -d "$1" ]; then
    printf 'directory\n'
  elif [ -e "$1" ]; then
    printf 'other (not a regular file, a symlink, or a directory)\n'
  else
    printf 'missing\n'
  fi
}

# Refuses, non-zero, rather than write through anything: a sidecar path already occupied by a
# symlink or a directory is left exactly as it is. The caller records no baseline entry in that
# case, so nothing can later mistake the unmarked divergence for a resolution.
write_sidecar() {
  sidecar_src=$1
  sidecar_dest=$2
  sidecar_path=$(sidecar_of "$sidecar_dest")
  if [ -e "$sidecar_path" ] || [ -L "$sidecar_path" ]; then
    if [ ! -f "$sidecar_path" ] || [ -L "$sidecar_path" ]; then
      echo "warn: cannot write conflict sidecar, $sidecar_path is not a regular file" >&2
      return 1
    fi
  fi
  {
    printf '<<<<<<< scaffold\n'
    describe_side "$sidecar_src"
    printf '=======\n'
    describe_side "$sidecar_dest"
    printf '>>>>>>> project\n'
  } > "$scratch"
  cat "$scratch" > "$sidecar_path"
}

# A sidecar that outlived its conflict — the path is identical to the source again, or was never
# there to begin with — is this script's own litter, and this script collects it. Non-zero when
# there was nothing to collect, so the caller can say so.
drop_stale_sidecar() {
  if has_sidecar "$1"; then
    rm -f "$(sidecar_of "$1")"
    return 0
  fi
  return 1
}

deliver() {
  deliver_src=$1
  deliver_dest=$2
  mkdir -p "$(dirname "$deliver_dest")"
  # Removed first so an update replaces a symlink instead of writing through it.
  rm -f "$deliver_dest"
  # -P copies a symlink as a symlink instead of dereferencing it. The link text is
  # relative, and the manifest reproduces the same tree, so it resolves in the target.
  cp -P "$deliver_src" "$deliver_dest"
  # Guard on -L: chmod follows symlinks, so an unguarded +x would mark the *target*
  # directory executable rather than the link.
  if [ ! -L "$deliver_src" ] && [ -x "$deliver_src" ]; then
    chmod +x "$deliver_dest"
  fi
}

owner=project

while IFS= read -r entry || [ -n "$entry" ]; do
  case "$entry" in
    '#'*)
      directive=${entry#\#}
      while :; do
        case "$directive" in
          ' '*|"$tab"*) directive=${directive#?} ;;
          *) break ;;
        esac
      done
      case "$directive" in
        '@owner '*)
          declared=${directive#'@owner '}
          declared=${declared%% *}
          case "$declared" in
            scaffold|project)
              owner=$declared
              ;;
            *)
              echo "warn: unknown owner '$declared' in manifest, falling back to project" >&2
              owner=project
              ;;
          esac
          ;;
      esac
      continue
      ;;
    '') continue ;;
  esac
  case "$entry" in
    */)
      dir_entry=${entry%/}
      src_dir="$source_root/$dir_entry"
      if [ ! -d "$src_dir" ]; then
        echo "warn: manifest directory not found, skipping: $entry" >&2
        continue
      fi
      # -type l as well as -type f: a symlink-to-directory (how .claude/skills/<name>
      # points at its canonical .agents/skills/<name>) is neither a file nor a directory
      # to find(1), so -type f alone would silently drop it from the copy set.
      find "$src_dir" \( -type f -o -type l \) | sort | while IFS= read -r file; do
        rel=${file#"$source_root"/}
        printf '%s\t%s\t%s\n' "$owner" "$file" "$rel" >> "$file_list"
      done
      ;;
    *)
      src_file="$source_root/$entry"
      if [ ! -f "$src_file" ]; then
        echo "warn: manifest file not found, skipping: $entry" >&2
        continue
      fi
      printf '%s\t%s\t%s\n' "$owner" "$src_file" "$entry" >> "$file_list"
      ;;
  esac
done < "$manifest"

created=0
updated=0
unchanged=0
resolved=0
skipped=0
conflicts=0
refused=0
conflict_paths=""

while IFS="$tab" read -r owner src rel; do
  dest="$target_dir/$rel"

  # Before anything reads or classifies the destination: a path beneath an ancestor that is not a
  # real directory is refused unread, whoever owns it — `✓ created` is a write too. Nothing is
  # written for it (no marker, no sidecar, no new baseline entry), which is what keeps the refusal
  # reversible: a resolvable opt-out for a deliberately shared subtree can be built on top of this
  # without undoing it.
  if ! contained "$rel"; then
    echo "⚠ conflict: $rel (beneath $offender/, which is not a directory — left untouched)"
    conflicts=$((conflicts + 1))
    conflict_paths="$conflict_paths$rel$nl"
    refused=$((refused + 1))
    # The refusal says nothing about the leaf's content, so the last agreement stands — exactly as
    # `⊘ skipped` preserves it. A target that reverts the ancestor then reports unchanged/updated
    # rather than conflicting on every file the scaffold moved meanwhile.
    read_baseline "$rel"
    if [ -n "$prev_flag" ]; then
      remember "$rel" "$prev_src" "$prev_dest" "$prev_flag"
    fi
    continue
  fi

  src_digest=$(digest "$src")

  if [ ! -e "$dest" ] && [ ! -L "$dest" ]; then
    deliver "$src" "$dest"
    if drop_stale_sidecar "$dest"; then
      echo "✓ created: $rel (stale conflict sidecar removed)"
    else
      echo "✓ created: $rel"
    fi
    created=$((created + 1))
    remember "$rel" "$src_digest" "$src_digest" -
    continue
  fi

  # Identical to the source: nothing to do and nothing outstanding, whatever an older entry
  # claimed — a conflict resolved toward the scaffold's version lands here. This runs before
  # anything else, so it is also where a sidecar beside a path that agrees with the source again
  # is collected; left behind, it would keep answering the skill's grep forever.
  if same "$src" "$dest"; then
    if drop_stale_sidecar "$dest"; then
      echo "= unchanged: $rel (stale conflict sidecar removed)"
    else
      echo "= unchanged: $rel"
    fi
    unchanged=$((unchanged + 1))
    remember "$rel" "$src_digest" "$src_digest" -
    continue
  fi

  read_baseline "$rel"
  dest_digest=$(digest "$dest")

  if has_markers "$dest"; then
    echo "⚠ conflict: $rel (markers from an earlier sync are still unresolved)"
    conflicts=$((conflicts + 1))
    conflict_paths="$conflict_paths$rel$nl"
    remember "$rel" "$src_digest" "$dest_digest" conflict
    continue
  fi

  # The same test for the other kind of mark. It sits here, beside has_markers and ahead of the
  # ownership test, so that the `resolved` branch below is reached only once neither mark is
  # left — which is what makes "sidecar deleted" resolve a conflict with no change to it.
  if has_sidecar "$dest"; then
    echo "⚠ conflict: $rel (conflict sidecar from an earlier sync is still there: $rel.scaffold-conflict)"
    conflicts=$((conflicts + 1))
    conflict_paths="$conflict_paths$rel$nl"
    remember "$rel" "$src_digest" "$dest_digest" conflict
    continue
  fi

  if [ "$owner" != scaffold ]; then
    echo "⊘ skipped: $rel (project-owned and divergent — the project's copy stands)"
    skipped=$((skipped + 1))
    if [ -n "$prev_flag" ]; then
      remember "$rel" "$prev_src" "$prev_dest" "$prev_flag"
    fi
    continue
  fi

  # Scaffold-owned and divergent from the source. Three questions, in order: were markers
  # resolved, has the destination moved off the agreed state, and did the scaffold move?

  if [ "$prev_flag" = conflict ]; then
    # Markers this script wrote, and no marker left in the file: a human resolved it. Whatever
    # they settled on is the state the two sides now agree on, so the next run reports it
    # unchanged rather than conflicting again — resolving a conflict has to be able to end it.
    echo "↺ resolved: $rel (the destination is the new agreed state)"
    resolved=$((resolved + 1))
    remember "$rel" "$src_digest" "$dest_digest" -
    continue
  fi

  if [ -n "$prev_flag" ] && [ "$prev_dest" = "$dest_digest" ]; then
    # The target has not touched the destination since the two sides last agreed.
    if [ "$prev_src" = "$src_digest" ]; then
      echo "= unchanged: $rel (neither side has moved since they last agreed)"
      unchanged=$((unchanged + 1))
      remember "$rel" "$prev_src" "$prev_dest" -
      continue
    fi
    if [ -L "$dest" ] || [ -f "$dest" ]; then
      # Only the scaffold moved, so the difference is its own: deliver it. This is the one-way
      # door ADR-0019 exists to open.
      deliver "$src" "$dest"
      echo "↻ updated: $rel"
      updated=$((updated + 1))
      remember "$rel" "$src_digest" "$src_digest" -
      continue
    fi
    # A directory (or other non-file) both sides agreed on, and the scaffold has moved. The
    # invariant forbids delivering over it — and deliver's `rm -f` would fail on a directory and
    # abort the whole run under `set -e` — so it falls through and conflicts, with a sidecar.
  fi

  conflicts=$((conflicts + 1))
  conflict_paths="$conflict_paths$rel$nl"
  if [ -L "$src" ] || [ -L "$dest" ] || [ ! -f "$dest" ]; then
    # Neither side is plain text to wrap in place: writing markers into a symlink would write
    # through it to whatever it points at, and into a directory not at all. The same block goes
    # beside the path instead (ADR-0020), and the entry is flagged like any other conflict — the
    # sidecar is what marks it outstanding, and deleting it is what resolves it.
    if write_sidecar "$src" "$dest"; then
      echo "⚠ conflict: $rel (conflict sidecar written: $rel.scaffold-conflict)"
      remember "$rel" "$src_digest" "$dest_digest" conflict
    else
      # The sidecar path is occupied by something this script will not write through, so nothing
      # marks the divergence outstanding. No entry is recorded: flagging it `conflict` with no
      # mark to remove would let the next run read the absent sidecar as a resolution and bless
      # the divergence unseen. The next run reaches this same conclusion instead.
      echo "⚠ conflict: $rel (not a regular file, and its conflict sidecar could not be written — resolve it by hand)"
    fi
  else
    write_conflict "$src" "$dest"
    echo "⚠ conflict: $rel (conflict markers written)"
    remember "$rel" "$src_digest" "$(digest "$dest")" conflict
  fi
done < "$file_list"

mkdir -p "$(dirname "$baseline")"
{
  echo "# Scaffold sync baseline — written by .agents/scripts/install-scaffold.sh."
  echo "#"
  echo "# One line per path, tab-separated:"
  echo "#   <path>  <what the scaffold delivered>  <the destination at the last agreement>  <flag>"
  echo "#"
  echo "# The two digests are what lets a later sync tell a file this project edited from one the"
  echo "# scaffold has moved ahead of, and a resolved conflict from an edit. The flag is \"-\", or"
  echo "# \"conflict\" while markers written by a sync — in the file, or in a sidecar beside it —"
  echo "# are still outstanding. Commit it; never hand-edit it. A line the script cannot parse is"
  echo "# treated as absent."
  sort -u "$new_baseline"
} > "$baseline"

echo ""
echo "Scaffold synced."
echo "Created:   $created files"
echo "Updated:   $updated files"
echo "Unchanged: $unchanged files"
echo "Resolved:  $resolved files (conflict markers resolved since the last sync)"
echo "Skipped:   $skipped files (project-owned and divergent, so left as they are)"
echo "Conflicts: $conflicts files"

if [ "$conflicts" -gt 0 ]; then
  echo ""
  echo "⚠ $conflicts file(s) diverged from the scaffold:"
  printf '%s' "$conflict_paths" | while IFS= read -r path; do
    if [ -n "$path" ]; then
      echo "  - $path"
    fi
  done
  echo ""
  echo "Those marked (conflict markers written) now carry <<<<<<< scaffold / ======= / >>>>>>> project"
  echo "blocks. Resolve them with the resolving-scaffold-sync skill, then re-run this script."
  echo ""
  echo "Those marked (conflict sidecar written) have a <path>.scaffold-conflict beside them: fix the"
  echo "path itself — rebuild the link, move the directory aside, or take the scaffold's file — then"
  echo "delete the sidecar."
  if [ "$refused" -gt 0 ]; then
    echo ""
    echo "Those marked (beneath …, which is not a directory) were neither read nor written: an ancestor"
    echo "of the path is a symlink, or a file where the scaffold ships a directory. Replace it with a"
    echo "real directory — or sync the directory it points at as its own target — then re-run."
  fi
  echo ""
  echo "This is not a git merge: there is nothing to --continue and nothing to abort."
  if [ "$conflicts" -gt 125 ]; then
    exit 125
  fi
  exit "$conflicts"
fi

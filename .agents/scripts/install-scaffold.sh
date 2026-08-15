#!/bin/sh
# install-scaffold.sh — manifest-driven copier for the cross-agent governance scaffold.
#
# Usage: install-scaffold.sh [target-dir]
#
# Reads .agents/scaffold.manifest relative to this script's own repo root (resolved from
# the script's own path, so it works whether run in-place or from a cloned/degit'd copy)
# and copies every listed file/directory into target-dir. Existing files in the target are
# left untouched and reported as skipped — safe to run repeatedly.
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

file_list=$(mktemp "${TMPDIR:-/tmp}/scaffold-manifest.XXXXXX")
trap 'rm -f "$file_list"' EXIT

while IFS= read -r entry || [ -n "$entry" ]; do
  case "$entry" in
    ''|'#'*) continue ;;
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
        printf '%s\t%s\n' "$file" "$rel" >> "$file_list"
      done
      ;;
    *)
      src_file="$source_root/$entry"
      if [ ! -f "$src_file" ]; then
        echo "warn: manifest file not found, skipping: $entry" >&2
        continue
      fi
      printf '%s\t%s\n' "$src_file" "$entry" >> "$file_list"
      ;;
  esac
done < "$manifest"

created=0
skipped=0
tab=$(printf '\t')

while IFS="$tab" read -r src rel; do
  dest="$target_dir/$rel"
  if [ -e "$dest" ]; then
    echo "⊘ skipped: $rel"
    skipped=$((skipped + 1))
    continue
  fi
  mkdir -p "$(dirname "$dest")"
  # -P copies a symlink as a symlink instead of dereferencing it. The link text is
  # relative, and the manifest reproduces the same tree, so it resolves in the target.
  cp -P "$src" "$dest"
  # Guard on -L: chmod follows symlinks, so an unguarded +x would mark the *target*
  # directory executable rather than the link.
  if [ ! -L "$src" ] && [ -x "$src" ]; then
    chmod +x "$dest"
  fi
  echo "✓ created: $rel"
  created=$((created + 1))
done < "$file_list"

echo ""
echo "Scaffold installed."
echo "Created: $created files"
echo "Skipped: $skipped files (already existed)"

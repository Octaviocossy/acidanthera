#!/bin/sh
# Build the glossary index: a term -> area pointer table for every canonical term in the
# vocabulary files, grouped under the file that defines it, written to the path given as $1.
#
# Grouping is what carries the pointer: the section heading is the path, so the row does not have
# to repeat it. One line per term either way, and the column that was 22 copies of one path is
# gone.
#
# The index is `@`-imported by CLAUDE.md (ADR-0016), and `@` takes a path, not a script — so
# unlike the corpus pack it cannot be rebuilt per invocation and must persist on disk. The
# staleness that buys is closed at the other end: `.agents/scripts/verify-scaffold.sh` rebuilds
# the index and fails the gate when the checked-in copy differs. Generated *and* verified.
#
# That contract only holds if the output is deterministic, so this script emits no timestamp and
# sorts under LC_ALL=C — a locale-dependent order would fail the gate on one machine and pass on
# every other. Sorting happens per source file, inside its own section, because the rows are now
# grouped rather than pooled.
#
# Sources are the two vocabulary bodies: the product glossary and the scaffold glossary, in that
# fixed order. The invariants file defines no terms (its content is constraints, already
# `@`-imported in full), the changelog is self-declared non-authoritative, and the index never
# reads itself.
#
# The table carries no definition text. A pointer cannot contradict the body it points at; a
# summary can, and then every term has two sources of truth.
#
# Usage:  sh .agents/scripts/build-glossary-index.sh <output-path>
#
# Exit codes:
#   0  index written
#   2  no output path given

set -eu

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$PROJECT_ROOT"

_out=${1:-}
if [ -z "$_out" ]; then
  echo "usage: sh .agents/scripts/build-glossary-index.sh <output-path>" >&2
  exit 2
fi

mkdir -p "$(dirname -- "$_out")"

{
  cat <<'HEADER_EOF'
# Ubiquitous Language — Index

> Generated — do not hand-edit. Rebuild with
> `sh .agents/scripts/build-glossary-index.sh .agents/ubiquitous-language-index.md`;
> `.agents/scripts/verify-scaffold.sh` §11 fails the gate when this copy is stale.
> Pointers only, no definitions (ADR-0016).
HEADER_EOF

  for _src in \
    ".agents/ubiquitous-language.md" \
    ".agents/ubiquitous-language-scaffold.md"
  do
    [ -f "$_src" ] || continue

    # Walk only the `## Glossary` section — the file-family table and the maintenance rules above
    # it are prose, not vocabulary — tracking the nearest preceding `### ` heading as the area.
    # Sorted here, per file, so each section is ordered within itself.
    _rows=$(awk '
      BEGIN { in_glossary = 0; area = "-" }

      # `### ` never matches here: its third character is "#", not a space.
      /^## / { in_glossary = ($0 ~ /^## Glossary[ \t]*$/); next }
      !in_glossary { next }

      /^### / {
        area = substr($0, 5)
        sub(/[ \t]+$/, "", area)
        next
      }

      /^\| / {
        # A regex constant, not the string "|": awks disagree on whether a single-character
        # string separator is literal or a regex, and an empty alternation would split wrongly.
        n = split($0, f, /\|/)
        if (n < 5) next
        term = f[2]
        gsub(/^[ \t]+|[ \t]+$/, "", term)
        if (term == "") next              # a leading empty cell is not a definition
        if (term == "Term") next          # the `| Term |` column header
        if (term ~ /^[:-]+$/) next        # a `| --- |` separator written with spaces
        if (term == "_Entity_") next      # the placeholder row the product template ships
        printf "| %s | %s |\n", term, area
      }
    ' "$_src" | LC_ALL=C sort)

    printf '\n## `%s`\n\n' "$_src"
    if [ -z "$_rows" ]; then
      # The scaffold ships the product glossary as an empty template; a project that has not
      # coined a term yet still gets a section, so the family's shape is visible from the index.
      printf '_No terms yet._\n'
    else
      printf '| Term | Area |\n|------|------|\n%s\n' "$_rows"
    fi
  done
} > "$_out"

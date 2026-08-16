#!/bin/sh
# sync-labels.sh — provision this project's closed-facet labels into GitHub.
#
# Reads the ```labels fence out of .agents/labels.md and creates or updates each entry with
# `gh label create --force`, so re-running is idempotent.
#
# Closed facets only. The open `area:` facet is deliberately NOT provisioned here — enumerating
# it would close it, and the issue-creating commands create an `area:` value on demand instead.
#
# Labels are informational; nothing in the execution pipeline reads one back (ADR-0031).
#
# One-shot per repository: run it once after installing the scaffold, and again only when
# .agents/labels.md changes.
#
#   sh .agents/scripts/sync-labels.sh
#
# Exit codes:
#   0  every label synced
#   1  one or more labels failed to sync
#   2  gh is not on PATH, or not authenticated
#   3  .agents/labels.md is missing or declares no labels

set -eu

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$PROJECT_ROOT"

_taxonomy=.agents/labels.md

command -v gh >/dev/null 2>&1 || {
  echo "sync-labels: gh is not on PATH — install it and run 'gh auth login'" >&2
  exit 2
}
gh auth status >/dev/null 2>&1 || {
  echo "sync-labels: gh is not authenticated — run 'gh auth login'" >&2
  exit 2
}
[ -f "$_taxonomy" ] || { echo "sync-labels: $_taxonomy is missing" >&2; exit 3; }

# Extract the body of the ```labels fence into a temp file. awk toggles on the opening fence
# and off at the next fence, so nothing outside the block is ever read. A file rather than a
# pipeline because `while ... | read` runs in a subshell, where the counters below would be
# incremented and then discarded.
_entries=$(mktemp)
trap 'rm -f "$_entries"' EXIT HUP INT TERM
awk '/^```labels$/ { inblock = 1; next } /^```/ { inblock = 0 } inblock' "$_taxonomy" > "$_entries"
[ -s "$_entries" ] || { echo "sync-labels: no \`\`\`labels block in $_taxonomy" >&2; exit 3; }

_synced=0
_failed=0
while IFS= read -r _line; do
  case "$_line" in ''|'#'*) continue ;; esac
  _name=$(printf '%s\n' "$_line" | awk '{ print $1 }')
  _color=$(printf '%s\n' "$_line" | awk '{ print $2 }')
  _desc=$(printf '%s\n' "$_line" | awk '{ $1=""; $2=""; sub(/^[[:space:]]+/, ""); print }')
  if gh label create "$_name" --color "$_color" --description "$_desc" --force >/dev/null 2>&1; then
    printf '  synced %s\n' "$_name"
    _synced=$((_synced + 1))
  else
    printf '  FAILED %s\n' "$_name" >&2
    _failed=$((_failed + 1))
  fi
done < "$_entries"

printf 'sync-labels: %d synced, %d failed. The open `area:` facet is created on demand, not here.\n' \
  "$_synced" "$_failed"

[ "$_failed" -eq 0 ] || exit 1

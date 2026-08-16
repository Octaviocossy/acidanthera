#!/bin/sh
# Build a corpus pack: the verbatim, path-separated concatenation of this repo's standards
# sources, written to the path given as $1.
#
# Lossless and per-invocation — never a cache, never a digest (ADR-0024). It is rebuilt from
# scratch every time, so there is nothing to invalidate and it can never go stale.
#
# Both review paths call this: the parallel runner at the start of every --review invocation,
# and the interactive gate (/review-branch, /execute-issue Phase 3) before dispatching its
# reviewer (ADR-0029). It lives in one script precisely so those two cannot drift apart.
#
# The source list below mirrors the "Step 3 — standards sources" grounding in
# .agents/skills/standards-and-spec-review/SKILL.md — keep both in sync.
#
# Usage:  sh .agents/scripts/build-corpus-pack.sh <output-path>
#
# Exit codes:
#   0  pack written
#   2  no output path given

set -eu

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$PROJECT_ROOT"

_out=${1:-}
if [ -z "$_out" ]; then
  echo "usage: sh .agents/scripts/build-corpus-pack.sh <output-path>" >&2
  exit 2
fi

mkdir -p "$(dirname -- "$_out")"
: > "$_out"
for _src in \
  "AGENTS.md" \
  .agents/rules/*.md \
  ".agents/ubiquitous-language.md" \
  .agents/adr/*.md
do
  [ -f "$_src" ] || continue
  printf '\n\n===== SOURCE: %s =====\n\n' "$_src" >> "$_out"
  cat "$_src" >> "$_out"
done

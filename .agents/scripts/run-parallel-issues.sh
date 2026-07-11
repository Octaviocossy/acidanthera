#!/bin/sh
# run-parallel-issues.sh — execute one "wave" of GitHub issues in parallel.
#
# Each argument is ONE child issue, encoded as:  <issue>:<branch>:<title>
#   <issue>  numeric GitHub issue number (no spaces)
#   <branch> git branch to create          (no spaces, e.g. 12-keystroke-capture)
#   <title>  human title (may contain spaces and ':'), used in commit + prompt
# Split is on the FIRST TWO colons only, so titles may contain ':'.
#
# Per issue: worktree+branch off BASE_BRANCH (or the epic integration branch, when
# --epic <branch> is passed), run the headless agent ($AGENT_EXEC_CMD) to implement the
# issue by following .agents/commands/execute-issue.md, then (only on success) commit +
# push. No GitHub API here. Config from .agents/parallel.config or env.
#
# --epic <branch>  optional; when present, children cut from and auto-merge into this
#                   branch after their own push succeeds (serialized via a `.merge.lock`
#                   mkdir lock + a dedicated __epic__ worktree — this script is the
#                   single writer of the epic branch). A merge conflict is recorded in
#                   .mergefail (the child branch stays pushed, just not integrated) and
#                   counts as a failure for this run's exit status.
#
# Outputs: .pushed (issue+branch per pushed child), .failed (issue per agent/push
# failure), .merged (issue+branch per child merged into the epic branch), .mergefail
# (issue per child that could not be merged into the epic branch).
# Exit status = number of FAILED + MERGEFAIL issues (0 = all succeeded and integrated).

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT" || { echo "FATAL: cannot cd to project root" >&2; exit 99; }

# ---- defaults (overridable by .agents/parallel.config or the environment) ----
AGENT_EXEC_CMD=${AGENT_EXEC_CMD:-"claude -p --dangerously-skip-permissions"}
PARALLEL_MAX_CONCURRENCY=${PARALLEL_MAX_CONCURRENCY:-3}
MAX_CHILDREN=${MAX_CHILDREN:-12}
WORKTREES_DIR=${WORKTREES_DIR:-.worktrees}
BASE_BRANCH=${BASE_BRANCH:-main}
ACCEPTANCE_CMD=${ACCEPTANCE_CMD:-}        # empty = skip acceptance gate in the runner
KEEP_WORKTREES=${KEEP_WORKTREES:-0}
AGENT_TIMEOUT=${AGENT_TIMEOUT:-1800}      # seconds per issue; 0 disables

# shellcheck disable=SC1091
[ -f "$PROJECT_ROOT/.agents/parallel.config" ] && . "$PROJECT_ROOT/.agents/parallel.config"

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }

# ---- optional epic integration branch (enables the auto-merge model) ----
EPIC_BRANCH=${EPIC_BRANCH:-}
if [ "${1:-}" = "--epic" ]; then
  [ "$#" -ge 2 ] || { log "FATAL: --epic requires a branch argument"; exit 2; }
  EPIC_BRANCH=$2
  shift 2
fi
EPIC_MERGE_FLAGS=${EPIC_MERGE_FLAGS:---no-ff}   # how children merge into the epic branch
EPIC_WT="$WORKTREES_DIR/__epic__"               # dedicated checkout of the epic branch
MERGE_LOCK="$WORKTREES_DIR/.merge.lock"         # serialize merge+push (single writer)

if [ "$#" -eq 0 ]; then
  log "usage: $0 <issue:branch:title> [<issue:branch:title> ...]"
  exit 2
fi
if [ "$#" -gt "$MAX_CHILDREN" ]; then
  log "WARNING: wave has $# issues but MAX_CHILDREN=$MAX_CHILDREN; refusing to fan out."
  log "         Re-run with a smaller wave or raise MAX_CHILDREN in .agents/parallel.config."
  exit 3
fi

mkdir -p "$WORKTREES_DIR"

_cli_bin=$(printf '%s\n' "$AGENT_EXEC_CMD" | awk '{print $1}')
if ! command -v "$_cli_bin" >/dev/null 2>&1; then
  log "FATAL: agent CLI '$_cli_bin' not on PATH (AGENT_EXEC_CMD=$AGENT_EXEC_CMD)."
  exit 4
fi

# optional per-issue wall-clock cap, portably (no GNU 'timeout' assumed)
run_with_timeout() {
  _secs=$1; shift
  if [ "$_secs" -le 0 ]; then "$@"; return $?; fi
  "$@" & _cmd_pid=$!
  ( sleep "$_secs"; kill -TERM "$_cmd_pid" 2>/dev/null ) & _killer=$!
  wait "$_cmd_pid"; _rc=$?
  kill -TERM "$_killer" 2>/dev/null
  wait "$_killer" 2>/dev/null
  return "$_rc"
}

acquire_lock() { until mkdir "$MERGE_LOCK" 2>/dev/null; do sleep 1; done; }
release_lock() { rmdir "$MERGE_LOCK" 2>/dev/null || true; }

# Create/refresh the epic worktree so it sits at the epic branch's current tip.
# If the branch already exists on origin, check that out; else cut it from BASE_BRANCH
# and publish it. Runs once, before any child fans out. No-op when EPIC_BRANCH is empty.
ensure_epic_branch() {
  [ -n "$EPIC_BRANCH" ] || return 0
  # Guard: refuse if the epic branch is checked out in the PRIMARY worktree (we cannot
  # also check it out here). The user should run /execute-epic from main or another branch.
  _cur=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$_cur" = "$EPIC_BRANCH" ]; then
    log "FATAL: epic branch '$EPIC_BRANCH' is checked out in the primary worktree."
    log "       Check out 'main' (or any other branch) before running the epic runner."
    exit 5
  fi
  git fetch --quiet origin >/dev/null 2>&1 || true
  [ -e "$EPIC_WT" ] && { git worktree remove --force "$EPIC_WT" >/dev/null 2>&1 || rm -rf "$EPIC_WT"; }
  if git ls-remote --exit-code --heads origin "$EPIC_BRANCH" >/dev/null 2>&1; then
    git worktree add -B "$EPIC_BRANCH" "$EPIC_WT" "origin/$EPIC_BRANCH" >/dev/null 2>&1
  else
    git worktree add -B "$EPIC_BRANCH" "$EPIC_WT" "origin/$BASE_BRANCH" >/dev/null 2>&1 \
      || git worktree add -B "$EPIC_BRANCH" "$EPIC_WT" "$BASE_BRANCH" >/dev/null 2>&1
    git -C "$EPIC_WT" push -u origin "$EPIC_BRANCH" >/dev/null 2>&1
  fi
}

process_issue() {
  _issue=$1; _branch=$2; _title=$3
  _wt="$WORKTREES_DIR/$_branch"
  _logf="$WORKTREES_DIR/$_branch.log"

  _base_ref=${EPIC_BRANCH:-$BASE_BRANCH}
  log "[#$_issue] start -> $_branch (base $_base_ref)"

  if [ -e "$_wt" ]; then
    git worktree remove --force "$_wt" >/dev/null 2>&1 || rm -rf "$_wt"
  fi
  if git show-ref --verify --quiet "refs/heads/$_branch"; then
    git worktree add "$_wt" "$_branch" >>"$_logf" 2>&1
  else
    git worktree add "$_wt" -b "$_branch" "$_base_ref" >>"$_logf" 2>&1
  fi
  if [ "$?" -ne 0 ]; then
    log "[#$_issue] FAILED: could not create worktree (see $_logf)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  _prompt=$(cat <<EOF
You are a headless coding agent working inside a git worktree for ONE GitHub issue.

Issue: #$_issue — $_title

Follow the procedure in .agents/commands/execute-issue.md (Phase 2 — Execution only;
there is NO human to confirm, treat Phase 1 as pre-approved). Use the linked plan file
in .agents/plans/ whose header contains "> Issue: #$_issue" as the primary source of
truth; if none exists, implement the issue body as described in #$_issue.

Honor AGENTS.md and the relevant .agents/rules/* files. Edit the working tree ONLY.
Do NOT run git commit, git push, or open a pull request — the runner does that.
Do NOT use any GitHub tools. When done, stop. Report what you changed.
EOF
)

  (
    cd "$_wt" || exit 91
    # shellcheck disable=SC2086
    run_with_timeout "$AGENT_TIMEOUT" $AGENT_EXEC_CMD "$_prompt"
  ) >>"$_logf" 2>&1
  _agent_rc=$?

  if [ "$_agent_rc" -ne 0 ]; then
    log "[#$_issue] FAILED: agent exited $_agent_rc (see $_logf). Not pushing."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if [ -z "$(git -C "$_wt" status --porcelain)" ]; then
    log "[#$_issue] FAILED: agent made no changes. Not pushing."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if [ -n "$ACCEPTANCE_CMD" ]; then
    if ! ( cd "$_wt" && sh -c "$ACCEPTANCE_CMD" ) >>"$_logf" 2>&1; then
      log "[#$_issue] FAILED: acceptance '$ACCEPTANCE_CMD' failed (see $_logf). Not pushing."
      echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
    fi
  fi

  git -C "$_wt" add -A >>"$_logf" 2>&1
  git -C "$_wt" commit -m "feat(#$_issue): $_title" \
      -m "Implements #$_issue via /execute-epic parallel runner." \
      -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
      >>"$_logf" 2>&1
  if [ "$?" -ne 0 ]; then
    log "[#$_issue] FAILED: git commit failed (see $_logf)."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if ! git -C "$_wt" push -u origin "$_branch" >>"$_logf" 2>&1; then
    log "[#$_issue] FAILED: git push failed (see $_logf)."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  log "[#$_issue] OK: pushed $_branch"
  echo "$_issue $_branch" >> "$WORKTREES_DIR/.pushed"

  # child branch is pushed and recorded in .pushed above; now integrate it.
  if [ -n "$EPIC_BRANCH" ]; then
    acquire_lock
    git -C "$EPIC_WT" fetch --quiet origin "$EPIC_BRANCH" >>"$_logf" 2>&1
    git -C "$EPIC_WT" reset --hard "origin/$EPIC_BRANCH" >>"$_logf" 2>&1
    # shellcheck disable=SC2086
    if git -C "$EPIC_WT" merge $EPIC_MERGE_FLAGS "$_branch" \
         -m "Merge child #$_issue ($_branch) into $EPIC_BRANCH" >>"$_logf" 2>&1 \
       && git -C "$EPIC_WT" push origin "$EPIC_BRANCH" >>"$_logf" 2>&1; then
      echo "$_issue $_branch" >> "$WORKTREES_DIR/.merged"
      log "[#$_issue] OK: merged $_branch into $EPIC_BRANCH"
      release_lock
    else
      git -C "$EPIC_WT" merge --abort >>"$_logf" 2>&1 || true
      git -C "$EPIC_WT" reset --hard "origin/$EPIC_BRANCH" >>"$_logf" 2>&1 || true
      echo "$_issue" >> "$WORKTREES_DIR/.mergefail"
      log "[#$_issue] MERGEFAIL: $_branch did not integrate into $EPIC_BRANCH (see $_logf)"
      release_lock
      # branch is pushed and safe; a human resolves the conflict. Treat as this-child failure.
      return 1
    fi
  fi

  if [ "$KEEP_WORKTREES" -ne 1 ]; then
    git worktree remove --force "$_wt" >/dev/null 2>&1 || rm -rf "$_wt"
  fi
  return 0
}

# ---- concurrency: job-slot loop, dash-safe (no `wait -n`) ----
: > "$WORKTREES_DIR/.failed"
: > "$WORKTREES_DIR/.pushed"
: > "$WORKTREES_DIR/.merged"
: > "$WORKTREES_DIR/.mergefail"
ensure_epic_branch
running_pids=""
running_count=0

drain_one() {
  _oldest=$(printf '%s\n' "$running_pids" | awk '{print $1}')
  [ -n "$_oldest" ] && wait "$_oldest"
  running_pids=$(printf '%s\n' "$running_pids" | cut -d' ' -f2-)
  running_count=$((running_count - 1))
}

for _rec in "$@"; do
  _issue=$(printf '%s' "$_rec" | cut -d: -f1)
  _branch=$(printf '%s' "$_rec" | cut -d: -f2)
  _title=$(printf '%s' "$_rec" | cut -d: -f3-)
  if [ -z "$_issue" ] || [ -z "$_branch" ]; then
    log "skip malformed record: '$_rec'"; continue
  fi
  while [ "$running_count" -ge "$PARALLEL_MAX_CONCURRENCY" ]; do drain_one; done
  process_issue "$_issue" "$_branch" "$_title" &
  running_pids="$running_pids $!"
  running_pids=$(printf '%s' "$running_pids" | sed 's/^ *//')
  running_count=$((running_count + 1))
done
while [ "$running_count" -gt 0 ]; do drain_one; done

failed=$(grep -c . "$WORKTREES_DIR/.failed" 2>/dev/null); failed=${failed:-0}
mergefail=$(grep -c . "$WORKTREES_DIR/.mergefail" 2>/dev/null); mergefail=${mergefail:-0}
pushed=$(grep -c . "$WORKTREES_DIR/.pushed" 2>/dev/null); pushed=${pushed:-0}
merged=$(grep -c . "$WORKTREES_DIR/.merged" 2>/dev/null); merged=${merged:-0}
total_fail=$((failed + mergefail))
if [ -n "$EPIC_BRANCH" ] && [ "$KEEP_WORKTREES" -ne 1 ]; then
  git worktree remove --force "$EPIC_WT" >/dev/null 2>&1 || rm -rf "$EPIC_WT"
fi
log "wave complete: $pushed pushed, $merged merged, $failed failed, $mergefail merge-conflict."
[ "$total_fail" -gt 0 ] && log "not integrated: $(tr '\n' ' ' < "$WORKTREES_DIR/.failed") $(tr '\n' ' ' < "$WORKTREES_DIR/.mergefail")"
exit "$total_fail"

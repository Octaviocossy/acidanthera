#!/bin/sh
# run-parallel-issues.sh — run one "wave" of GitHub issues through the staged
# epic pipeline: plain run -> --review -> --rework (optional) -> --integrate.
#
# Each positional argument is ONE child issue, encoded as:  <issue>:<branch>:<title>
#   <issue>  numeric GitHub issue number (no spaces)
#   <branch> git branch to create/reuse    (no spaces, e.g. 12-keystroke-capture)
#   <title>  human title (may contain spaces and ':'), used in commit + prompt
# Split is on the FIRST TWO colons only, so titles may contain ':'.
#
# --epic <branch>   optional; also read from the EPIC_BRANCH env var as a fallback. When
#                    present, children are cut from (and, on --integrate, merged into) this
#                    epic integration branch instead of BASE_BRANCH. Required by every
#                    action flag below. Must come first.
# --review           requires --epic. Fans out one standards-and-spec-review agent per
#                    named child (via REVIEW_AGENT_EXEC_CMD) against the epic branch and
#                    writes its report to .worktrees/<branch>.review.md. Reads the same
#                    .worktrees/<branch>.issue.md the caller wrote before the plain run.
#                    Builds .worktrees/.corpus-pack.md (verbatim concatenation of the
#                    standards sources) first and names it — plus .worktrees/.epic-issue.md,
#                    if the caller wrote it — in each child's review prompt.
# --rework           requires --epic. Reads .worktrees/<branch>.feedback (written by the
#                    caller), re-dispatches the implementing agent, and on success appends
#                    a `rework(#<issue>): ronda <n>` commit to the child's branch. Refuses
#                    once MAX_REWORK_ROUNDS is reached (round count derived from git).
# --integrate         requires --epic. Merges each named child into the epic branch
#                    (serialized via a `.merge.lock` mkdir lock + a dedicated __epic__
#                    worktree — this script is the epic branch's single writer), deletes
#                    the child's branch from origin (unless KEEP_CHILD_BRANCHES=1), and is
#                    the only action that removes the child's worktree on success.
#
# A run with NO action flag is a plain run: implement, commit, push each child. It never
# merges, and it retains the worktree (through the whole review gate) rather than removing
# it — only --integrate does that. A worktree is also retained on any action's failure, for
# inspection. Config from .agents/parallel.config or the environment.
#
# A plain run and --review both read .worktrees/<branch>.issue.md if the caller wrote it
# before invoking — neither has GitHub access, so without this file the implementing agent
# cannot fetch the issue it was asked to build, and the reviewer falls back to the plan
# file for its Spec axis. The caller is expected to write it once, before the plain run.
#
# Outputs (truncated and rebuilt on every invocation, so each reflects only the action
# just run): .pushed (issue+branch per pushed child, plain run only), .failed (issue per
# failure in whichever action ran), .merged (issue+branch per child merged into the epic
# branch, --integrate only), .mergefail (issue per child that could not be merged).
# Exit status = number of FAILED + MERGEFAIL entries produced by this invocation.

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT" || { echo "FATAL: cannot cd to project root" >&2; exit 99; }

# ---- defaults (overridable by .agents/parallel.config or the environment) ----
AGENT_EXEC_CMD=${AGENT_EXEC_CMD:-"claude -p --dangerously-skip-permissions"}
PARALLEL_MAX_CONCURRENCY=${PARALLEL_MAX_CONCURRENCY:-3}
MAX_CHILDREN=${MAX_CHILDREN:-12}
MAX_REWORK_ROUNDS=${MAX_REWORK_ROUNDS:-2}  # 0 disables rework: a rejection just blocks
WORKTREES_DIR=${WORKTREES_DIR:-.worktrees}
BASE_BRANCH=${BASE_BRANCH:-main}
ACCEPTANCE_CMD=${ACCEPTANCE_CMD:-}        # empty = skip acceptance gate in the runner
KEEP_WORKTREES=${KEEP_WORKTREES:-0}
AGENT_TIMEOUT=${AGENT_TIMEOUT:-1800}      # seconds per issue; 0 disables
KEEP_CHILD_BRANCHES=${KEEP_CHILD_BRANCHES:-0}  # 1 = keep a child's branch after it merges into the epic branch

# shellcheck disable=SC1091
[ -f "$PROJECT_ROOT/.agents/parallel.config" ] && . "$PROJECT_ROOT/.agents/parallel.config"

# empty REVIEW_AGENT_EXEC_CMD means "inherit AGENT_EXEC_CMD", never "skip the review" —
# resolved AFTER sourcing the config so an explicit empty string in the file still inherits.
REVIEW_AGENT_EXEC_CMD=${REVIEW_AGENT_EXEC_CMD:-$AGENT_EXEC_CMD}

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }

# ---- optional epic integration branch (required by every action flag) ----
EPIC_BRANCH=${EPIC_BRANCH:-}
if [ "${1:-}" = "--epic" ]; then
  [ "$#" -ge 2 ] || { log "FATAL: --epic requires a branch argument"; exit 2; }
  EPIC_BRANCH=$2
  shift 2
fi
EPIC_MERGE_FLAGS=${EPIC_MERGE_FLAGS:---no-ff}   # how children merge into the epic branch
EPIC_WT="$WORKTREES_DIR/__epic__"               # dedicated checkout of the epic branch
MERGE_LOCK="$WORKTREES_DIR/.merge.lock"         # serialize merge+push (single writer)
CORPUS_PACK="$WORKTREES_DIR/.corpus-pack.md"    # shared review input — rebuilt per --review (ADR-0024)
EPIC_ISSUE_FILE="$WORKTREES_DIR/.epic-issue.md" # epic issue body, written by the caller (never by the runner)

# ---- optional action flag: plain run (none) | --review | --rework | --integrate ----
ACTION=""
case "${1:-}" in
  --review) ACTION=review ;;
  --rework) ACTION=rework ;;
  --integrate) ACTION=integrate ;;
esac
if [ -n "$ACTION" ]; then
  if [ -z "$EPIC_BRANCH" ]; then
    log "FATAL: --$ACTION requires --epic <branch> (or the EPIC_BRANCH env var)"
    exit 2
  fi
  shift
fi

if [ "$#" -eq 0 ]; then
  log "usage: $0 [--epic <branch>] [--review|--rework|--integrate] <issue:branch:title> [...]"
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
_review_cli_bin=$(printf '%s\n' "$REVIEW_AGENT_EXEC_CMD" | awk '{print $1}')
if ! command -v "$_review_cli_bin" >/dev/null 2>&1; then
  log "FATAL: review agent CLI '$_review_cli_bin' not on PATH (REVIEW_AGENT_EXEC_CMD=$REVIEW_AGENT_EXEC_CMD)."
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

# Make sure a child's worktree exists at $WORKTREES_DIR/<branch>, recreating it from the
# already-pushed branch when it was cleaned up or never fanned out in this invocation.
# Used by --review and --rework, which run inside the child's own checkout.
ensure_child_worktree() {
  _branch=$1
  _wt="$WORKTREES_DIR/$_branch"
  _logf="$WORKTREES_DIR/$_branch.log"
  [ -e "$_wt" ] && return 0
  if git show-ref --verify --quiet "refs/heads/$_branch"; then
    git worktree add "$_wt" "$_branch" >>"$_logf" 2>&1 && return 0
  fi
  git fetch --quiet origin "$_branch" >>"$_logf" 2>&1
  git worktree add "$_wt" -b "$_branch" "origin/$_branch" >>"$_logf" 2>&1
}

# Build the corpus pack: a verbatim, path-separated concatenation of the standards
# sources, rebuilt from scratch on every --review invocation. Lossless and
# per-invocation — never a cache, never a digest (ADR-0024). The source list is a
# hardcoded mirror of the skill's "In this repository" grounding (Step 3 — standards
# sources) in .agents/skills/standards-and-spec-review/SKILL.md — keep both in sync.
build_corpus_pack() {
  : > "$CORPUS_PACK"
  for _src in \
    "AGENTS.md" \
    .agents/rules/*.md \
    ".agents/ubiquitous-language.md" \
    .agents/adr/*.md
  do
    [ -f "$_src" ] || continue
    printf '\n\n===== SOURCE: %s =====\n\n' "$_src" >> "$CORPUS_PACK"
    cat "$_src" >> "$CORPUS_PACK"
  done
}

# ---- plain run: implement, commit, push. Never merges; retains the worktree. ----
process_plain_run() {
  _issue=$1; _branch=$2; _title=$3
  _wt="$WORKTREES_DIR/$_branch"
  _logf="$WORKTREES_DIR/$_branch.log"
  _issuef="$PROJECT_ROOT/$WORKTREES_DIR/$_branch.issue.md"

  _base_ref=${EPIC_BRANCH:-$BASE_BRANCH}
  log "[#$_issue] start -> $_branch (base $_base_ref)"

  if [ -f "$_issuef" ]; then
    _issue_note="read the issue body at $_issuef (you have no GitHub access and cannot fetch it yourself)."
  else
    _issue_note="no issue body was made available at $_issuef and you have no GitHub access to fetch #$_issue yourself — note the gap in your report instead of guessing at the issue's content."
  fi

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
truth; if none exists, $_issue_note

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
      >>"$_logf" 2>&1
  if [ "$?" -ne 0 ]; then
    log "[#$_issue] FAILED: git commit failed (see $_logf)."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if ! git -C "$_wt" push -u origin "$_branch" >>"$_logf" 2>&1; then
    log "[#$_issue] FAILED: git push failed (see $_logf)."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  log "[#$_issue] OK: pushed $_branch (worktree retained for review)"
  echo "$_issue $_branch" >> "$WORKTREES_DIR/.pushed"
  return 0
}

# ---- --review: fan out the agentic review, write .worktrees/<branch>.review.md ----
process_review() {
  _issue=$1; _branch=$2; _title=$3
  _wt="$WORKTREES_DIR/$_branch"
  _logf="$WORKTREES_DIR/$_branch.log"
  _reviewf="$WORKTREES_DIR/$_branch.review.md"
  _issuef="$PROJECT_ROOT/$WORKTREES_DIR/$_branch.issue.md"
  _packf="$PROJECT_ROOT/$CORPUS_PACK"
  _epicf="$PROJECT_ROOT/$EPIC_ISSUE_FILE"

  if ! ensure_child_worktree "$_branch"; then
    log "[#$_issue] FAILED: could not prepare worktree for review (see $_logf)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  if [ -f "$_issuef" ]; then
    _issue_note="The issue body is at $_issuef — read it as the Spec axis's source before falling back to the plan file."
  else
    _issue_note="No issue body was made available at $_issuef (the runner has no GitHub access) — fall back to the linked plan file or note that none is available."
  fi
  if [ -f "$_packf" ]; then
    _pack_note="A corpus pack — the verbatim, path-separated concatenation of every standards source — is at $_packf. Hand that ONE file to the Standards sub-agent as its complete standards sources. Do not read the pack or the raw standards sources yourself, and never give the pack to the Spec sub-agent."
  else
    _pack_note="No corpus pack exists at $_packf — fall back to the skill's grounding: the Standards sub-agent reads the raw standards sources itself."
  fi
  if [ -f "$_epicf" ]; then
    _epic_note="The epic issue body is at $_epicf — pass its path to the Spec sub-agent so it knows this child's intended scope and which sibling work is legitimately visible."
  else
    _epic_note="No epic issue body is available (the runner has no GitHub access) — the Spec sub-agent works from the child issue's header lines alone."
  fi

  _review_prompt=$(cat <<EOF
You are a headless reviewer working inside a git worktree for ONE epic child.

Run the standards-and-spec-review process (.agents/skills/standards-and-spec-review/SKILL.md)
over this child's diff.

Fixed point: $EPIC_BRANCH — this is an epic child, so diff three-dot against the epic
integration branch, never against main.
Child issue: #$_issue — $_title
$_issue_note

Follow the skill's "In this repository" grounding for the hard-violation vs
judgement-call split and the two-subagent dispatch. You orchestrate WITHOUT reading
source contents: verify the files below exist, build the two sub-agent prompts from
their paths, and aggregate the two reports.
$_pack_note
$_epic_note
This is a headless run and must never stop to ask — if the fixed point or a spec
source cannot be resolved, note that and continue.

Output ONLY the final aggregated Standards + Spec report as your entire final message —
it is saved verbatim as the review record.
EOF
)

  (
    cd "$_wt" || exit 91
    # shellcheck disable=SC2086
    run_with_timeout "$AGENT_TIMEOUT" $REVIEW_AGENT_EXEC_CMD "$_review_prompt"
  ) >"$_reviewf" 2>>"$_logf"
  _rc=$?

  if [ "$_rc" -ne 0 ] || [ ! -s "$_reviewf" ]; then
    log "[#$_issue] FAILED: review agent exited $_rc or produced no report (see $_logf)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  log "[#$_issue] OK: review written to $_reviewf"
  return 0
}

# ---- --rework: re-dispatch a rejected child with its feedback, append a round commit ----
process_rework() {
  _issue=$1; _branch=$2; _title=$3
  _wt="$WORKTREES_DIR/$_branch"
  _logf="$WORKTREES_DIR/$_branch.log"
  _feedbackf="$WORKTREES_DIR/$_branch.feedback"

  if [ ! -f "$_feedbackf" ]; then
    log "[#$_issue] FAILED: no feedback file at $_feedbackf"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if ! ensure_child_worktree "$_branch"; then
    log "[#$_issue] FAILED: could not prepare worktree for rework (see $_logf)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  _prior=$(git -C "$_wt" log --oneline --grep="^rework(#$_issue): ronda " 2>/dev/null | grep -c .)
  _prior=${_prior:-0}
  if [ "$_prior" -ge "$MAX_REWORK_ROUNDS" ]; then
    log "[#$_issue] FAILED: rework cap exhausted ($_prior/$MAX_REWORK_ROUNDS rounds run)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  _round=$((_prior + 1))

  _feedback=$(cat "$_feedbackf")
  _diff=$(git -C "$_wt" diff "$EPIC_BRANCH...HEAD" 2>/dev/null)

  _prompt=$(cat <<EOF
You are a headless coding agent reworking a REJECTED epic child — round $_round.

Issue: #$_issue — $_title

This branch was reviewed and rejected. Feedback to address:
---
$_feedback
---

Current diff against the epic branch ($EPIC_BRANCH):
---
$_diff
---

Address every point in the feedback. Honor AGENTS.md and the relevant .agents/rules/*
files, same as the original implementation. Edit the working tree ONLY. Do NOT run git
commit, git push, or open a pull request — the runner does that. Do NOT use any GitHub
tools. When done, stop. Report what you changed.
EOF
)

  (
    cd "$_wt" || exit 91
    # shellcheck disable=SC2086
    run_with_timeout "$AGENT_TIMEOUT" $AGENT_EXEC_CMD "$_prompt"
  ) >>"$_logf" 2>&1
  _agent_rc=$?

  if [ "$_agent_rc" -ne 0 ]; then
    log "[#$_issue] FAILED: rework agent exited $_agent_rc (see $_logf)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if [ -z "$(git -C "$_wt" status --porcelain)" ]; then
    log "[#$_issue] FAILED: rework agent made no changes"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  git -C "$_wt" add -A >>"$_logf" 2>&1
  git -C "$_wt" commit -m "rework(#$_issue): ronda $_round" \
      -m "Addresses review feedback for #$_issue." \
      >>"$_logf" 2>&1
  if [ "$?" -ne 0 ]; then
    log "[#$_issue] FAILED: rework commit failed (see $_logf)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if ! git -C "$_wt" push origin "$_branch" >>"$_logf" 2>&1; then
    log "[#$_issue] FAILED: rework push failed (see $_logf)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  log "[#$_issue] OK: rework round $_round pushed to $_branch"
  return 0
}

# ---- --integrate: merge an approved child into the epic branch, then clean up ----
process_integrate() {
  _issue=$1; _branch=$2; _title=$3
  _wt="$WORKTREES_DIR/$_branch"
  _logf="$WORKTREES_DIR/$_branch.log"

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
    # child is fully contained in the epic branch now; drop its branch unless asked to keep it.
    if [ "$KEEP_CHILD_BRANCHES" -ne 1 ]; then
      if git push origin --delete "$_branch" >>"$_logf" 2>&1; then
        log "[#$_issue] deleted merged branch $_branch (remote)"
      else
        log "[#$_issue] note: could not delete branch $_branch (already gone?) — see $_logf"
      fi
    fi
  else
    git -C "$EPIC_WT" merge --abort >>"$_logf" 2>&1 || true
    git -C "$EPIC_WT" reset --hard "origin/$EPIC_BRANCH" >>"$_logf" 2>&1 || true
    echo "$_issue" >> "$WORKTREES_DIR/.mergefail"
    log "[#$_issue] MERGEFAIL: $_branch did not integrate into $EPIC_BRANCH (see $_logf)"
    release_lock
    # branch is pushed and safe; a human resolves the conflict. Treat as this-child failure.
    return 1
  fi

  if [ "$KEEP_WORKTREES" -ne 1 ]; then
    git worktree remove --force "$_wt" >/dev/null 2>&1 || rm -rf "$_wt"
  fi
  return 0
}

case "$ACTION" in
  "") _handler=process_plain_run ;;
  review) _handler=process_review ;;
  rework) _handler=process_rework ;;
  integrate) _handler=process_integrate ;;
esac

# ---- concurrency: job-slot loop, dash-safe (no `wait -n`) ----
: > "$WORKTREES_DIR/.failed"
: > "$WORKTREES_DIR/.pushed"
: > "$WORKTREES_DIR/.merged"
: > "$WORKTREES_DIR/.mergefail"
ensure_epic_branch
if [ "$ACTION" = "review" ]; then build_corpus_pack; fi
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
  "$_handler" "$_issue" "$_branch" "$_title" &
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
log "wave complete [${ACTION:-run}]: $pushed pushed, $merged merged, $failed failed, $mergefail merge-conflict."
[ "$total_fail" -gt 0 ] && log "not integrated: $(tr '\n' ' ' < "$WORKTREES_DIR/.failed") $(tr '\n' ' ' < "$WORKTREES_DIR/.mergefail")"
exit "$total_fail"

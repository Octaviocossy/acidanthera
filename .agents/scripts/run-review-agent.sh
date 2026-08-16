#!/bin/sh
# Dispatch ONE single-axis agentic reviewer under REVIEW_AGENT_EXEC_CMD and print its report
# to stdout.
#
# This is the one reviewer dispatcher for every review path (ADR-0030): the interactive gate
# (/review-branch, /execute-issue Phase 3) calls it once per axis from the repository root, and
# run-parallel-issues.sh --review calls it once per axis per child from inside the child's
# worktree. One command-prefix contract (the prompt is appended as the final quoted positional
# argument), one wall-clock cap, one startup-collision retry — shared so the paths cannot drift.
# The reviewer must be a fresh context that did not write the code, and is deliberately allowed
# to be a different model than the implementer's (ADR-0028): a reviewer sharing the
# implementer's blind spots is a weaker check.
#
# Why a script rather than calling the CLI directly from the command: REVIEW_AGENT_EXEC_CMD
# lives in .agents/parallel.config, which is gitignored and per-machine. A slash-command
# wrapper cannot pre-approve a command it is not allowed to know, so it pre-approves this
# script instead and the config stays free to change.
#
# The reviewer runs in the CALLER'S working directory — this script never cd's. That is what
# lets the same dispatcher serve both paths: the session invokes it at the repo root, the
# runner invokes it inside a child's worktree so the reviewer reads the child's checkout.
# Nothing here is axis-aware: the caller varies the prompt, and each invocation is an
# independent process. Concurrent invocations do not interact.
#
# Usage:  sh .agents/scripts/run-review-agent.sh "<review prompt>"
#
# Exit codes:
#   0  report printed to stdout
#   2  no prompt argument
#   3  no reviewer configured — caller should fall back to in-session sub-agents
#   4  the configured reviewer CLI is not on PATH
# 124  the reviewer exceeded REVIEW_TIMEOUT and was terminated
#   *  whatever the reviewer CLI exited with

set -eu

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)

_prompt=${1:-}
if [ -z "$_prompt" ]; then
  echo "usage: sh .agents/scripts/run-review-agent.sh \"<review prompt>\"" >&2
  exit 2
fi

# GITHUB_TOKEN is never sourced here, exactly as in run-parallel-issues.sh: the reviewer
# reads the working tree and is handed its sources by path. That is not the same as the
# reviewer having no GitHub access — a CLI that loads a project MCP config can reach GitHub
# through run-github-mcp.sh, which sources .env itself — so source-by-path is enforced by the
# caller's prompt, never assumed from the environment (ADR-0028).
#
# The environment wins over the config file, the same precedence run-parallel-issues.sh uses.
# Sourcing a config that unconditionally clobbers the environment would make a one-off override
# (raising REVIEW_TIMEOUT to watch a slow review, say) impossible without editing a per-machine
# file. A missing config file is not an error by itself — an env-only setup (the runner's own
# convention) is legitimate; exit 3 only when neither file nor environment yields a command.
_env_review=${REVIEW_AGENT_EXEC_CMD:-}
_env_agent=${AGENT_EXEC_CMD:-}
_env_timeout=${REVIEW_TIMEOUT:-}
AGENT_EXEC_CMD=""
REVIEW_AGENT_EXEC_CMD=""
REVIEW_TIMEOUT=""
CONFIG="$PROJECT_ROOT/.agents/parallel.config"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"
[ -n "$_env_review" ] && REVIEW_AGENT_EXEC_CMD=$_env_review
[ -n "$_env_agent" ] && AGENT_EXEC_CMD=$_env_agent
[ -n "$_env_timeout" ] && REVIEW_TIMEOUT=$_env_timeout

# Empty means "inherit the implementer's command", never "skip the review" — the same
# deliberate departure from the ACCEPTANCE_CMD="" convention the runner documents.
REVIEW_AGENT_EXEC_CMD=${REVIEW_AGENT_EXEC_CMD:-$AGENT_EXEC_CMD}
if [ -z "$REVIEW_AGENT_EXEC_CMD" ]; then
  echo "neither REVIEW_AGENT_EXEC_CMD nor AGENT_EXEC_CMD is set ($CONFIG or environment)" >&2
  exit 3
fi

_bin=$(printf '%s\n' "$REVIEW_AGENT_EXEC_CMD" | awk '{print $1}')
if ! command -v "$_bin" >/dev/null 2>&1; then
  echo "review agent CLI '$_bin' not on PATH (REVIEW_AGENT_EXEC_CMD=$REVIEW_AGENT_EXEC_CMD)" >&2
  exit 4
fi

# Wall-clock cap, per attempt. An external reviewer that goes hunting for sources instead of
# reading the ones it was handed will otherwise run until something kills it. Deliberately
# tighter than AGENT_TIMEOUT (which caps a whole implementing agent): a review is one axis over
# pre-materialized inputs, and on the interactive path a human is sitting there watching a
# silent terminal, so failing fast beats finishing eventually.
REVIEW_TIMEOUT=${REVIEW_TIMEOUT:-900}

# Grace between SIGTERM and SIGKILL, so a reviewer that handles SIGTERM gets to flush whatever
# partial output it has before it is killed outright. Niche enough to stay env-only, as are the
# three retry knobs below (see the retry loop at the bottom for what they guard against).
REVIEW_KILL_GRACE=${REVIEW_KILL_GRACE:-10}
REVIEW_RETRIES=${REVIEW_RETRIES:-1}
REVIEW_RETRY_WINDOW=${REVIEW_RETRY_WINDOW:-30}
REVIEW_RETRY_DELAY=${REVIEW_RETRY_DELAY:-15}

# stdin is closed deliberately: the reviewer is non-interactive, and a CLI that decides to read
# stdin would otherwise block forever with no output and no error — indistinguishable from a
# slow review.
if [ "$REVIEW_TIMEOUT" -le 0 ]; then
  # shellcheck disable=SC2086
  exec $REVIEW_AGENT_EXEC_CMD "$_prompt" </dev/null
fi

# Portable watchdog — no GNU `timeout` assumed, same reason as run_with_timeout() in
# run-parallel-issues.sh. Written defensively because this script runs under `set -e`, where a
# non-zero `wait` or a `kill` of an already-dead watchdog would abort before the exit code is
# inspected.
#
# Two things this does that inferring from the exit status alone cannot:
#
#   * It records that it fired in a marker file. Reading "timed out" off exit status 143 is a
#     guess: a reviewer that traps SIGTERM and exits 0 would be reported as a clean pass, which
#     is precisely the "never present a timed-out axis as a pass" rule inverted.
#   * It escalates to SIGKILL after a grace period. A reviewer that ignores SIGTERM would
#     otherwise leave `wait` blocking forever — reintroducing the unbounded hang the cap exists
#     to prevent, now with the cap's own machinery holding the door open.
# Retry on a fast, silent failure. Both review paths dispatch several of these concurrently —
# one per axis, up to two per child under the runner (ADR-0030) — and agent CLIs keep per-user
# state that simultaneous launches can collide on: opencode fails within a second with
# "database is locked" on a shared ~/.local/share/opencode/opencode.db, whatever directory each
# process runs in. The contention is at startup only — measured, not assumed: the same two
# dispatches offset by a few seconds both complete. So one retry after a short wait clears it,
# and does so wherever it happens rather than at an offset the caller had to guess right.
#
# The retry is deliberately narrow. It fires only when the reviewer exits non-zero, fast, and
# wrote **no report** — that is, nothing on stdout. Diagnostics on stderr do not count and must
# not: `database is locked` arrives on stderr, so treating any output at all as disqualifying
# would exclude the one failure this retry exists for. A review that fails on its own merits
# either takes real time or says something on stdout first. A timeout never retries — it already
# spent the full clock, and spending another is exactly what a cap is for.
_attempt=0
while :; do
  _out=$(mktemp) || { echo "cannot create output buffer" >&2; exit 1; }
  _timeout_marker=$(mktemp) || { echo "cannot create timeout marker" >&2; rm -f "$_out"; exit 1; }
  _started=$(date +%s)

  # shellcheck disable=SC2086
  $REVIEW_AGENT_EXEC_CMD "$_prompt" </dev/null >"$_out" &
  _cmd_pid=$!
  (
    sleep "$REVIEW_TIMEOUT"
    echo timeout > "$_timeout_marker"
    kill -TERM "$_cmd_pid" 2>/dev/null
    sleep "$REVIEW_KILL_GRACE"
    kill -KILL "$_cmd_pid" 2>/dev/null
  ) &
  _killer=$!
  _rc=0
  wait "$_cmd_pid" || _rc=$?
  kill -TERM "$_killer" 2>/dev/null || true
  wait "$_killer" 2>/dev/null || true

  _timed_out=0
  [ -s "$_timeout_marker" ] && _timed_out=1
  rm -f "$_timeout_marker"
  _elapsed=$(( $(date +%s) - _started ))

  # 124 is the `timeout(1)` convention, so the caller can tell "ran out of wall clock" from "the
  # reviewer failed". Those want different responses — only the first is worth re-running with a
  # larger REVIEW_TIMEOUT. Whatever the reviewer exited with is discarded here on purpose: once
  # the watchdog fired, that status describes how the process reacted to being killed, not the
  # review. Partial output is dropped with it — a half-written report read as a whole one is the
  # "never present a timed-out axis as a pass" rule defeated at the last step.
  if [ "$_timed_out" -eq 1 ]; then
    rm -f "$_out"
    echo "review agent exceeded REVIEW_TIMEOUT=${REVIEW_TIMEOUT}s and was terminated" >&2
    exit 124
  fi

  if [ "$_rc" -ne 0 ] && [ ! -s "$_out" ] &&
     [ "$_elapsed" -lt "$REVIEW_RETRY_WINDOW" ] && [ "$_attempt" -lt "$REVIEW_RETRIES" ]; then
    _attempt=$((_attempt + 1))
    rm -f "$_out"
    echo "review agent failed in ${_elapsed}s with no output (exit $_rc) — likely a concurrent-startup collision; retrying in ${REVIEW_RETRY_DELAY}s (attempt $((_attempt + 1)))" >&2
    sleep "$REVIEW_RETRY_DELAY"
    continue
  fi

  cat "$_out"
  rm -f "$_out"
  exit "$_rc"
done

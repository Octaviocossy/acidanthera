#!/bin/sh
# Dispatch one agentic review under REVIEW_AGENT_EXEC_CMD and print its report to stdout.
#
# This is the interactive counterpart of run-parallel-issues.sh's --review action: same
# config key, same command-prefix contract (the prompt is appended as the final quoted
# positional argument), same reason for existing — the reviewer must be a fresh context
# that did not write the code, and is deliberately allowed to be a different model than
# the implementer's. A reviewer sharing the implementer's blind spots is a weaker check.
#
# Why a script rather than calling the CLI directly from the command: REVIEW_AGENT_EXEC_CMD
# lives in .agents/parallel.config, which is gitignored and per-machine. A slash-command
# wrapper cannot pre-approve a command it is not allowed to know, so it pre-approves this
# script instead and the config stays free to change.
#
# Usage:  sh .agents/scripts/run-review-agent.sh "<review prompt>"
#
# Exit codes:
#   0  report printed to stdout
#   2  no prompt argument
#   3  no reviewer configured — caller should fall back to in-session sub-agents
#   4  the configured reviewer CLI is not on PATH
#   *  whatever the reviewer CLI exited with

set -eu

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$PROJECT_ROOT"

_prompt=${1:-}
if [ -z "$_prompt" ]; then
  echo "usage: sh .agents/scripts/run-review-agent.sh \"<review prompt>\"" >&2
  exit 2
fi

CONFIG=".agents/parallel.config"
if [ ! -f "$CONFIG" ]; then
  echo "no $CONFIG — no external reviewer configured" >&2
  exit 3
fi

# GITHUB_TOKEN is never sourced here, exactly as in run-parallel-issues.sh: the reviewer
# reads the working tree and is handed its sources by path. It has no GitHub access by design.
#
# The environment wins over the config file, the same precedence run-parallel-issues.sh uses.
# Sourcing a config that unconditionally clobbers the environment would make a one-off override
# (adding --print-logs to watch a slow review, say) impossible without editing a per-machine file.
_env_review=${REVIEW_AGENT_EXEC_CMD:-}
_env_agent=${AGENT_EXEC_CMD:-}
AGENT_EXEC_CMD=""
REVIEW_AGENT_EXEC_CMD=""
# shellcheck disable=SC1090
. "./$CONFIG"
[ -n "$_env_review" ] && REVIEW_AGENT_EXEC_CMD=$_env_review
[ -n "$_env_agent" ] && AGENT_EXEC_CMD=$_env_agent

# Empty means "inherit the implementer's command", never "skip the review" — the same
# deliberate departure from the ACCEPTANCE_CMD="" convention the runner documents.
REVIEW_AGENT_EXEC_CMD=${REVIEW_AGENT_EXEC_CMD:-$AGENT_EXEC_CMD}
if [ -z "$REVIEW_AGENT_EXEC_CMD" ]; then
  echo "neither REVIEW_AGENT_EXEC_CMD nor AGENT_EXEC_CMD is set in $CONFIG" >&2
  exit 3
fi

_bin=$(printf '%s\n' "$REVIEW_AGENT_EXEC_CMD" | awk '{print $1}')
if ! command -v "$_bin" >/dev/null 2>&1; then
  echo "review agent CLI '$_bin' not on PATH (REVIEW_AGENT_EXEC_CMD=$REVIEW_AGENT_EXEC_CMD)" >&2
  exit 4
fi

# stdin is closed deliberately: the reviewer is non-interactive, and a CLI that decides to read
# stdin would otherwise block forever with no output and no error — indistinguishable from a
# slow review.
# shellcheck disable=SC2086
exec $REVIEW_AGENT_EXEC_CMD "$_prompt" </dev/null

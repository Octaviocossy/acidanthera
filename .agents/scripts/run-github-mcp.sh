#!/bin/sh
# Sources project .env and launches the official GitHub MCP server over stdio.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

set -a
# shellcheck disable=SC1091
[ -f "$PROJECT_ROOT/.env" ] && . "$PROJECT_ROOT/.env"
# shellcheck disable=SC1091
[ -f "$PROJECT_ROOT/.env.local" ] && . "$PROJECT_ROOT/.env.local"
set +a

# github-mcp-server reads GITHUB_PERSONAL_ACCESS_TOKEN; map our GITHUB_TOKEN onto it.
export GITHUB_PERSONAL_ACCESS_TOKEN="${GITHUB_TOKEN}"

# GUI-launched agents may start with a minimal PATH; make sure Homebrew bins are found.
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export PATH

# Official GitHub MCP server (github/github-mcp-server), installed via `brew install github-mcp-server`.
exec github-mcp-server stdio

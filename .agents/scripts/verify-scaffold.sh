#!/bin/sh
# verify-scaffold.sh — zero-dependency acceptance gate for this scaffold's structural
# integrity. POSIX sh only; no package manager, no external tooling beyond core
# utilities (find, grep, git) that every clone of this repo already has.
#
# Run from anywhere: resolves the project root from this script's own location.
#
#   sh .agents/scripts/verify-scaffold.sh
#
# Exit status = number of failed checks (0 = scaffold is structurally sound).

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT" || { echo "FATAL: cannot cd to project root" >&2; exit 99; }

FAILS=0

# \033 and the UTF-8 byte sequences below are octal escapes — the one printf(1) escape
# form POSIX and every /bin/sh (dash, bash, ash, zsh) agree on. Avoid \xHH: dash's builtin
# printf does not support it and would print the escape literally instead of the glyph.
pass() { printf '  \033[32m\342\234\223\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m\342\234\227\033[0m %s\n' "$1"; FAILS=$((FAILS + 1)); }
section() { printf '\n%s\n' "$1"; }

# ---- 1. Required root and governance files exist ----
section "Required files"
for f in AGENTS.md CLAUDE.md README.md .gitignore .agents/ubiquitous-language.md; do
  if [ -f "$f" ]; then
    pass "$f exists"
  else
    fail "$f is missing"
  fi
done

# ---- 2. Every canonical command spec has a Claude + OpenCode wrapper ----
# .agents/rules/command-creation.md: .agents/commands/<name>.md is the source of truth;
# .claude/commands/<name>.md and .opencode/commands/<name>.md must both exist alongside it.
section "Command triads (.agents/commands + .claude/commands + .opencode/commands)"
if [ -d .agents/commands ]; then
  for spec in .agents/commands/*.md; do
    [ -e "$spec" ] || continue
    name=$(basename "$spec")
    claude_wrapper=".claude/commands/$name"
    opencode_wrapper=".opencode/commands/$name"
    if [ -f "$claude_wrapper" ] && [ -f "$opencode_wrapper" ]; then
      pass "$name has both wrappers"
    else
      [ -f "$claude_wrapper" ] || fail "$claude_wrapper is missing"
      [ -f "$opencode_wrapper" ] || fail "$opencode_wrapper is missing"
    fi
  done
else
  fail ".agents/commands/ directory is missing"
fi

# ---- 3. Wrapper bodies (post-frontmatter) must be identical, per
# .agents/rules/command-creation.md: "Keep the Claude and OpenCode wrapper bodies
# identical — only frontmatter may differ." Nothing else checks this; a wrapper can
# silently drift out of sync with its sibling otherwise.
section "Wrapper body parity"
body_of() { awk 'BEGIN{fm=0} /^---$/ && fm<2 {fm++; next} fm>=2 {print}' "$1"; }
if [ -d .agents/commands ]; then
  for spec in .agents/commands/*.md; do
    [ -e "$spec" ] || continue
    name=$(basename "$spec")
    claude_wrapper=".claude/commands/$name"
    opencode_wrapper=".opencode/commands/$name"
    if [ -f "$claude_wrapper" ] && [ -f "$opencode_wrapper" ]; then
      t1=$(mktemp)
      t2=$(mktemp)
      body_of "$claude_wrapper" > "$t1"
      body_of "$opencode_wrapper" > "$t2"
      if diffout=$(diff -u "$t1" "$t2" 2>&1); then
        pass "$name wrapper bodies match"
      else
        fail "wrapper body drift: $claude_wrapper vs $opencode_wrapper"
        printf '%s\n' "$diffout" >&2
      fi
      rm -f "$t1" "$t2"
    fi
  done
fi

# ---- 4. Every wrapper declares at minimum a `description:` frontmatter field ----
section "Wrapper frontmatter"
for wrapper in .claude/commands/*.md .opencode/commands/*.md; do
  [ -e "$wrapper" ] || continue
  if head -n 10 "$wrapper" | grep -q '^description:'; then
    pass "$wrapper declares description"
  else
    fail "$wrapper is missing a description: frontmatter field"
  fi
done

# ---- 5. Every shell script under .agents/scripts/ is syntactically valid and executable ----
section "Shell scripts"
if [ -d .agents/scripts ]; then
  for script in .agents/scripts/*.sh; do
    [ -e "$script" ] || continue
    if sh -n "$script" 2>/dev/null; then
      pass "$script parses cleanly (sh -n)"
    else
      fail "$script has a syntax error"
    fi
    if [ -x "$script" ]; then
      pass "$script is executable"
    else
      fail "$script is not executable (chmod +x)"
    fi
  done
else
  fail ".agents/scripts/ directory is missing"
fi

# ---- 6. Scaffold manifest entries all resolve to real paths ----
section "Scaffold manifest"
manifest=.agents/scaffold.manifest
if [ -f "$manifest" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    if [ -e "$line" ]; then
      pass "manifest entry $line exists"
    else
      fail "manifest entry $line does not exist"
    fi
  done < "$manifest"
else
  pass "$manifest not present (optional until the scaffold copier lands) — skipped"
fi

# ---- 7. No leftover app-specific artifacts (this scaffold is stack-neutral) ----
# Only meaningful in the scaffold *source* repo. A scaffolded project is supposed to have a
# stack, and this script ships to every one of them via .agents/scripts/. The manifest is the
# discriminator: it is not listed in itself, so it never reaches a scaffolded project.
section "Stack neutrality"
if [ ! -f .agents/scaffold.manifest ]; then
  pass "not the scaffold source repo — skipped"
elif command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  leftovers=$(git ls-files | grep -E '^(src/|src-tauri/|package\.json$)' || true)
  if [ -z "$leftovers" ]; then
    pass "no tracked src/, src-tauri/, or package.json artifacts"
  else
    fail "stack-specific artifacts are still tracked: $(printf '%s' "$leftovers" | tr '\n' ' ')"
  fi
else
  pass "not a git checkout — skipped tracked-file check"
fi

# ---- 8. Skills: one canonical body in .agents/skills/, symlinked into .claude/skills/ ----
# .agents/rules/skill-creation.md: Claude Code does not read .agents/skills/, so each skill
# needs a symlink under .claude/skills/. OpenCode additionally requires the frontmatter
# `name` to match the directory name.
section "Skills"
if [ -d .agents/skills ]; then
  for skill_dir in .agents/skills/*/; do
    [ -d "$skill_dir" ] || continue
    name=$(basename "$skill_dir")
    skill_md="${skill_dir}SKILL.md"
    if [ ! -f "$skill_md" ]; then
      fail "$skill_md is missing"
      continue
    fi
    pass "$name has SKILL.md"
    # \42 and \47 are " and ' — octal keeps the quotes out of this command substitution.
    fm_name=$(awk '/^---$/{n++; next} n==1 && /^name:/{sub(/^name:[ \t]*/, ""); print; exit}' \
      "$skill_md" | tr -d '\42\47 \r')
    if [ "$fm_name" = "$name" ]; then
      pass "$name frontmatter name matches its directory"
    else
      fail "$skill_md declares name '$fm_name' but lives in '$name/'"
    fi
    if awk '/^---$/{n++; next} n==1' "$skill_md" | grep -q '^description:'; then
      pass "$name declares description"
    else
      fail "$skill_md is missing a description: frontmatter field"
    fi
    if [ -L ".claude/skills/$name" ] && [ -f ".claude/skills/$name/SKILL.md" ]; then
      pass "$name is symlinked into .claude/skills/"
    else
      fail ".claude/skills/$name must be a symlink to the canonical skill directory"
    fi
  done
fi

# ---- Summary ----
section "Summary"
if [ "$FAILS" -eq 0 ]; then
  printf '  scaffold verified clean.\n'
else
  printf '  %d check(s) failed.\n' "$FAILS"
fi

exit "$FAILS"

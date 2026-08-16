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
for f in AGENTS.md CLAUDE.md .gitignore .agents/ubiquitous-language.md; do
  if [ -f "$f" ]; then
    pass "$f exists"
  else
    fail "$f is missing"
  fi
done
# README.md documents this scaffold, not a scaffolded project, so it is deliberately absent
# from the manifest. Requiring it unconditionally would make every fresh /install-scaffold produce
# a tree that fails its own acceptance gate. Same source-repo discriminator as section 7.
if [ -f .agents/scaffold.manifest ]; then
  if [ -f README.md ]; then
    pass "README.md exists"
  else
    fail "README.md is missing"
  fi
fi

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
    # .agents/rules/command-creation.md (Naming): the `# Command: <name>` heading must match
    # the filename. Nothing else catches a rename that moved the files but not the heading.
    slug=${name%.md}
    heading=$(head -n 1 "$spec")
    if [ "$heading" = "# Command: $slug" ]; then
      pass "$name heading matches its filename"
    else
      fail "$spec first line is '$heading', expected '# Command: $slug'"
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

# ---- 9. Manifest coverage: shippable artifacts are actually listed ----
# Section 6 checks manifest -> repo. This checks repo -> manifest, for the two roots the
# manifest enumerates file by file instead of copying recursively: ADRs and .example
# templates. Without it a new file lands referenced-but-not-shipped — how
# .agents/adr/0019-*.md and .agents/parallel.config.example both drifted, each cited by an
# AGENTS.md or rules file that *is* shipped. plans/ and specs/ are deliberately excluded:
# only their .gitkeep ships.
section "Manifest coverage"
if [ -f "$manifest" ]; then
  for f in .agents/adr/*.md .agents/*.example; do
    [ -f "$f" ] || continue
    # -Fx: literal, whole-line — so one entry never matches another by substring.
    if grep -Fxq "$f" "$manifest"; then
      pass "$f is listed in the manifest"
    else
      fail "$f exists but is not listed in $manifest"
    fi
  done
else
  pass "$manifest not present — skipped"
fi

# ---- 10. Label taxonomy is present and declares its closed facet ----
# .agents/labels.md is the single source of truth for sync-labels.sh and the three
# issue-writing commands. Section 6 catches it going missing; this catches it going empty,
# which would silently stop every issue from being labelled.
section "Label taxonomy"
if [ -f .agents/labels.md ]; then
  pass ".agents/labels.md exists"
  if grep -q '^```labels$' .agents/labels.md; then
    pass ".agents/labels.md declares a labels block"
  else
    fail ".agents/labels.md has no labels block — sync-labels.sh would find nothing"
  fi
  if grep -Eq '^type:[a-z-]+[[:space:]]+[0-9a-fA-F]{6}[[:space:]]' .agents/labels.md; then
    pass ".agents/labels.md declares at least one type: value"
  else
    fail ".agents/labels.md declares no type: value in name/color/description form"
  fi
else
  fail ".agents/labels.md is missing"
fi

# ---- Summary ----
section "Summary"
if [ "$FAILS" -eq 0 ]; then
  printf '  scaffold verified clean.\n'
else
  printf '  %d check(s) failed.\n' "$FAILS"
fi

exit "$FAILS"

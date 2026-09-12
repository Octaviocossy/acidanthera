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
for f in AGENTS.md CLAUDE.md .gitignore \
         .agents/ubiquitous-language.md \
         .agents/ubiquitous-language-index.md \
         .agents/ubiquitous-language-invariants.md \
         .agents/ubiquitous-language-scaffold.md \
         .agents/ubiquitous-language-changelog.md; do
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

# ---- 11. Glossary budget (ADR-0043) ----
# Prose rules were tried here and failed — the 2026-07-22 cleanup wrote anti-append rules into
# domain-glossary.md and the file grew roughly sixfold afterwards. This is the mechanical half.
section "Glossary budget"

GLOSSARY_CEILING=600
GLOSSARY_WARN=80000
GLOSSARY_FAIL=100000

_body='.agents/ubiquitous-language.md'
_scaffold='.agents/ubiquitous-language-scaffold.md'
_invariants='.agents/ubiquitous-language-invariants.md'

# The ceiling is in BYTES (ADR-0043). awk's length() counts characters in a multibyte locale
# on some awks (gawk), bytes on others (macOS awk) — LC_ALL=C makes every awk below count
# bytes, so the check means the same thing on every machine.
#
# 11a. Per-row ceiling. Column 5 of a vocabulary table row is the Notes cell. Rows are split on
# UNESCAPED pipes: several cells legitimately contain `\|` (e.g. `'edit' \| 'read'`), and a naive
# split would both mis-measure them and report the wrong column.
_oversized_rows() {
  LC_ALL=C awk -v limit="$GLOSSARY_CEILING" -v file="$1" '
    /^\| / {
      if ($0 ~ /^\|[-: |]+\|$/) next
      line = $0
      gsub(/\\\|/, "\001", line)          # protect escaped pipes
      n = split(line, cell, "|")
      if (n < 6) next
      term = cell[2]; notes = cell[5]
      gsub(/^[ \t]+|[ \t]+$/, "", term); gsub(/^[ \t]+|[ \t]+$/, "", notes)
      if (term == "Term" || term == "File") next
      if (length(notes) > limit) printf "%s: %s (%d B)\n", file, term, length(notes)
    }' "$1"
}

_row_report=$( { _oversized_rows "$_body"; _oversized_rows "$_scaffold"; } 2>/dev/null )
if [ -z "$_row_report" ]; then
  pass "no Notes cell exceeds ${GLOSSARY_CEILING} B"
else
  fail "Notes cells over ${GLOSSARY_CEILING} B (one-claim rule — move rationale into the ADR):"
  printf '%s\n' "$_row_report" | while IFS= read -r _l; do printf '      %s\n' "$_l"; done
fi

# 11b. Per-invariant ceiling. Each invariant is one line, numbered, in either invariant file.
_oversized_invariants() {
  LC_ALL=C awk -v limit="$GLOSSARY_CEILING" -v file="$1" '
    /^[0-9]+\. / {
      if (length($0) > limit) { num = $1; sub(/\.$/, "", num)
        printf "%s: invariant %s (%d B)\n", file, num, length($0) }
    }' "$1"
}

_inv_report=$( { _oversized_invariants "$_invariants"; _oversized_invariants "$_scaffold"; } 2>/dev/null )
if [ -z "$_inv_report" ]; then
  pass "no invariant exceeds ${GLOSSARY_CEILING} B"
else
  fail "invariants over ${GLOSSARY_CEILING} B:"
  printf '%s\n' "$_inv_report" | while IFS= read -r _l; do printf '      %s\n' "$_l"; done
fi

# 11c. Total cap on the vocabulary body: warn at 80 KB, fail at 100 KB.
if [ -f "$_body" ]; then
  _bytes=$(wc -c < "$_body" | tr -d ' ')
  if [ "$_bytes" -ge "$GLOSSARY_FAIL" ]; then
    fail "$_body is ${_bytes} B, at or over the ${GLOSSARY_FAIL} B hard cap — retire rows"
  elif [ "$_bytes" -ge "$GLOSSARY_WARN" ]; then
    pass "$_body is ${_bytes} B — WARNING: $((_bytes - GLOSSARY_WARN)) B over the ${GLOSSARY_WARN} B soft cap"
  else
    pass "$_body is ${_bytes} B (under the ${GLOSSARY_WARN} B soft cap)"
  fi
fi

# 11d. Index freshness. `@` imports a path and cannot run a script, so the index is checked in;
# diffing it against a fresh build is what stops it going stale (ADR-0041, ADR-0024).
if [ -x .agents/scripts/build-glossary-index.sh ] || [ -f .agents/scripts/build-glossary-index.sh ]; then
  _tmp_index=$(mktemp 2>/dev/null || echo "/tmp/glossary-index.$$")
  if sh .agents/scripts/build-glossary-index.sh "$_tmp_index" >/dev/null 2>&1 &&
     diff -q "$_tmp_index" .agents/ubiquitous-language-index.md >/dev/null 2>&1; then
    pass "glossary index is current"
  else
    fail "glossary index is stale — run sh .agents/scripts/build-glossary-index.sh"
  fi
  rm -f "$_tmp_index"
else
  fail ".agents/scripts/build-glossary-index.sh is missing"
fi

# 11e. The `settled ahead of implementation` marker is abolished (ADR-0042), so it must appear in
# none of the four AUTHORITATIVE files. The changelog is exempt: its rows are verbatim historical
# record, and several of them describe the convention as it stood on the date they were written.
# Rewriting the record to satisfy a string check would falsify the record — the abolition is of
# the convention, not of the fact that it was once used.
# `|| true`: a no-match grep exits 1. This script runs under `set -u`, not `set -e`, so that is
# harmless today — but it would abort the run the day anyone adds errexit, and it would abort it
# precisely when the check PASSES, which is the hardest failure of all to notice.
_marker_hits=$(grep -l 'settled ahead of implementation' \
  "$_body" "$_scaffold" "$_invariants" .agents/ubiquitous-language-index.md 2>/dev/null || true)
if [ -z "$_marker_hits" ]; then
  pass "no 'settled ahead of implementation' marker in an authoritative glossary file"
else
  fail "'settled ahead of implementation' is abolished (ADR-0042) but appears in:"
  printf '%s\n' "$_marker_hits" | while IFS= read -r _l; do printf '      %s\n' "$_l"; done
fi

# 11f. The exemption above is only defensible while the changelog SAYS it is a historical record
# that abolished the marker. Without this check the exemption is indistinguishable from the file
# simply going unchecked, and would silently widen the moment someone stopped reading 11e.
_changelog='.agents/ubiquitous-language-changelog.md'
if ! grep -q 'settled ahead of implementation' "$_changelog" 2>/dev/null; then
  pass "changelog carries no abolished marker (the 11e exemption is currently unused)"
elif grep -q 'Historical rows are verbatim and are never rewritten' "$_changelog" 2>/dev/null; then
  pass "changelog declares its abolished-marker rows historical (11e exemption justified in-file)"
else
  fail "$_changelog contains 'settled ahead of implementation' but does not declare its rows historical — state the ADR-0042 abolition in its header, or drop the 11e exemption"
fi

# ---- Summary ----
section "Summary"
if [ "$FAILS" -eq 0 ]; then
  printf '  scaffold verified clean.\n'
else
  printf '  %d check(s) failed.\n' "$FAILS"
fi

exit "$FAILS"

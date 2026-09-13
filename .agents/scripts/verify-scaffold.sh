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
# \342\232\240 is the warning sign. warn() deliberately leaves FAILS alone: a warning is notice
# during normal growth, and only the hard number moves the exit status (section 12, ADR-0018).
warn() { printf '  \033[33m\342\232\240\033[0m %s\n' "$1"; }
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
    # The exact text, not merely "a link that resolves": ADR-0001 requires the relative
    # ../../.agents/skills/<name>, and a link re-pointed at another skill still resolves to a
    # readable SKILL.md — so a test that stops at -f would pass it.
    link=".claude/skills/$name"
    want="../../.agents/skills/$name"
    if [ -L "$link" ] && [ -f "$link/SKILL.md" ]; then
      pass "$name is symlinked into .claude/skills/"
      got=$(readlink "$link")
      if [ "$got" = "$want" ]; then
        pass "$name link text is $want"
      else
        fail "$link points at '$got', expected '$want' (ADR-0001)"
      fi
    else
      fail "$link must be a symlink to the canonical skill directory"
    fi
  done
fi

# ---- 9. Manifest coverage: shippable artifacts are actually listed ----
# Section 6 checks manifest -> repo. This checks repo -> manifest, for the two roots the
# manifest enumerates file by file instead of copying recursively: ADRs and .example
# templates. Without it a new file lands referenced-but-not-shipped — how
# .agents/adr/0003-*.md and .agents/parallel.config.example both drifted, each cited by an
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

# ---- 11. The checked-in glossary index is a fresh build of the vocabulary it points at ----
# .agents/ubiquitous-language-index.md is @-imported by CLAUDE.md (ADR-0016), and @ takes a path,
# not a script — so unlike the corpus pack it cannot dodge staleness by being rebuilt per
# invocation (ADR-0013) and has to persist. Generating it is therefore only half the answer: this
# check is the other half. A stale index is worse than no index, because it tells an agent a term
# does not exist when it does, which is how duplicate vocabulary gets coined.
section "Glossary index"
index=.agents/ubiquitous-language-index.md
index_builder=.agents/scripts/build-glossary-index.sh
if [ ! -f "$index_builder" ]; then
  # Same source-repo discriminator style as sections 6 and 7: a scaffolded project that has not
  # installed the generator must not fail its own gate.
  pass "$index_builder not present — skipped"
elif [ ! -f "$index" ]; then
  fail "$index is missing — build it with: sh $index_builder $index"
else
  t3=$(mktemp)
  if ! sh "$index_builder" "$t3" >/dev/null 2>&1; then
    fail "$index_builder failed to run — cannot verify $index"
  elif idxdiff=$(diff -u "$index" "$t3" 2>&1); then
    pass "$index matches a fresh build"
  else
    fail "$index is stale — regenerate with: sh $index_builder $index"
    printf '%s\n' "$idxdiff" >&2
  fi
  rm -f "$t3"
fi

# ---- 12. The glossary stays inside its declared byte budget ----
# ADR-0018: every definition row's Notes cell is capped at a fixed, universal 600 B, and each
# glossary file declares its own total warn/fail cap in its own header. Prose rules against
# glossary growth have been tried and have failed — downstream, a cleanup marked *completed* both
# compressed the glossary and wrote the anti-append rules, after which the file grew roughly
# sixfold. A mechanical failure is the only thing that forces a retirement decision instead of
# letting the file grow silently.
#
# The two halves are configurable to different degrees, deliberately. The row ceiling is fixed
# here because it is mechanical and travels unchanged between projects — a project able to declare
# `notes 5000` in its own header would have exactly the silent growth the ADR exists to stop. The
# total cap is read from the file it governs, because it depends on the size of a domain only the
# project knows: the two cannot drift, and configuring it never means editing a scaffold-owned
# script. A file that declares no budget is skipped, so a scaffolded project that has not adopted
# the regime still passes its own gate.
section "Glossary budget"

# Fixed and universal (ADR-0018). The `notes` field in a header is a declaration to verify against
# this number, never a value to trust: it documents the ceiling where a reader will look for it.
NOTES_CEILING=600

# "notes 600 <sep> warn 16384 <sep> fail 24576 (bytes)" -> the integer following $2. Scanning for
# the keyword rather than splitting on the separator keeps the header's shape a human choice.
budget_field() {
  printf '%s\n' "$1" |
    awk -v key="$2" '{
      for (i = 1; i < NF; i++)
        if ($i == key && $(i + 1) ~ /^[0-9]+$/) { print $(i + 1); exit }
    }'
}

for gfile in .agents/ubiquitous-language*.md; do
  [ -f "$gfile" ] || continue
  # head -n 1 rather than grep -m 1: -m is a GNU/BSD extension, and this script's whole premise
  # is that it runs anywhere with no dependencies.
  budget_line=$(grep '^> \*\*Budget:\*\*' "$gfile" 2>/dev/null | head -n 1)
  if [ -z "$budget_line" ]; then
    # The changelog (append-only history) and the index (generated) are deliberately uncapped.
    pass "$gfile declares no budget - skipped"
    continue
  fi

  b_notes=$(budget_field "$budget_line" notes)
  b_warn=$(budget_field "$budget_line" warn)
  b_fail=$(budget_field "$budget_line" fail)
  if [ -z "$b_notes" ] || [ -z "$b_warn" ] || [ -z "$b_fail" ]; then
    fail "$gfile has an unparseable Budget line, expected 'notes N ... warn N ... fail N': $budget_line"
    continue
  fi
  # A header that disagrees with the enforced ceiling is caught here rather than honored, for the
  # same reason the totals live in the file they govern: a documented number that can drift from
  # its subject silently is worse than no number at all.
  if [ "$b_notes" -ne "$NOTES_CEILING" ]; then
    fail "$gfile declares 'notes $b_notes' but the Notes ceiling is a fixed $NOTES_CEILING B (ADR-0018)"
    continue
  fi

  # LC_ALL=C so length() counts bytes: under a UTF-8 locale gawk counts characters instead, and
  # the same glossary would then pass on one machine and fail on another. The budget is in bytes.
  t4=$(mktemp)
  LC_ALL=C awk -v limit="$NOTES_CEILING" '
    BEGIN { in_glossary = 0; in_invariants = 0; buf = "" }

    # An invariant bullet wraps across lines, so it is joined before being measured. A Notes cell
    # cannot: a markdown table row is one line by definition, so field 5 is already the whole cell —
    # minus the spaces that pad it inside the row, which are layout, not content, and minus any
    # `\|` a cell escapes, which is a character of the cell, not a column break.
    function flush_bullet(   n, label) {
      if (buf == "") return
      n = length(buf)
      if (n > limit) {
        label = buf
        sub(/^- +/, "", label)
        if (match(label, /\*\*[^*]+\*\*/)) label = substr(label, RSTART + 2, RLENGTH - 4)
        printf "%s\t%d\t%s\n", label, n, "invariant"
      }
      buf = ""
    }

    # `### ` never matches: its third character is "#", not a space. Both section flags are reset
    # on every `## `, so each measurement is scoped to the section that owns that shape.
    /^## / {
      flush_bullet()
      in_glossary = ($0 ~ /^## Glossary[ \t]*$/)
      in_invariants = ($0 ~ /^## Invariants[ \t]*$/ || $0 ~ /^## Invariants[ \t]+/)
      next
    }

    # Only inside the invariants section: a bold bullet in ordinary prose is not an invariant, and
    # measuring one would fail the gate over something that never claimed to be a term.
    in_invariants && /^- \*\*/ { flush_bullet(); buf = $0; next }
    buf != "" && /^[ \t]+[^ \t]/ { line = $0; sub(/^[ \t]+/, "", line); buf = buf " " line; next }
    buf != "" { flush_bullet() }

    in_glossary && /^\| / {
      # A regex constant, not the string "|": awks disagree on whether a single-character string
      # separator is literal or a regex.
      row = $0
      gsub(/\\\|/, "\001", row)         # protect escaped pipes before splitting on the real ones
      n = split(row, f, /\|/)
      if (n < 6) next
      term = f[2]
      gsub(/^[ \t]+|[ \t]+$/, "", term)
      if (term == "") next            # a leading empty cell is not a definition
      if (term == "Term") next        # the column header
      if (term ~ /^[:-]+$/) next      # a `| --- |` separator written with spaces
      notes = f[5]
      gsub(/^[ \t]+|[ \t]+$/, "", notes)
      if (length(notes) > limit) printf "%s\t%d\t%s\n", term, length(notes), "Notes cell"
    }

    END { flush_bullet() }
  ' "$gfile" > "$t4"

  if [ -s "$t4" ]; then
    tab=$(printf '\t')
    while IFS="$tab" read -r b_term b_size b_kind; do
      fail "$gfile: '$b_term' $b_kind is $b_size B, over the $NOTES_CEILING B ceiling"
    done < "$t4"
  else
    pass "$gfile rows are within the $NOTES_CEILING B ceiling"
  fi
  rm -f "$t4"

  gbytes=$(wc -c < "$gfile" | tr -d ' ')
  if [ "$gbytes" -gt "$b_fail" ]; then
    fail "$gfile is $gbytes B, over its $b_fail B fail cap - retire a term (ADR-0018)"
  elif [ "$gbytes" -gt "$b_warn" ]; then
    warn "$gfile is $gbytes B, over its $b_warn B warn cap (fails at $b_fail B)"
  else
    pass "$gfile is $gbytes B, within its $b_warn B warn cap"
  fi
done

# ---- 13. No unresolved scaffold-sync conflict is committed ----
# A conflicted sync is a failed sync (ADR-0019): a marker block left in a file, or a conflict
# sidecar left beside a path (ADR-0020), must fail here too, not only on the next sync. The
# opening marker is matched at column 1 only — the skill, the glossary and the script all mention
# the marker strings mid-line or indented, and must go on doing so. Generated trees are pruned:
# .git, the runner's .worktrees, and Claude Code's .claude/worktrees. `find -prune` plus a read
# loop rather than `grep --exclude-dir`, which is a GNU extension this scaffold cannot assume.
section "Sync conflicts"
t5=$(mktemp)
find . \( -path ./.git -o -path ./.worktrees -o -path ./.claude/worktrees \) -prune -o -type f -print 2>/dev/null |
  while IFS= read -r f; do
    case "$f" in
      # Classified once. A sidecar carries the marker block by design, so testing it for markers
      # too would double-count one failure and hand the resolver the wrong instruction: a sidecar
      # is never the thing to edit, the path beside it is.
      *.scaffold-conflict)
        printf 'sidecar\t%s\n' "$f"
        ;;
      *)
        if grep -q '^<<<<<<< scaffold$' "$f" 2>/dev/null; then
          printf 'marker\t%s\n' "$f"
        fi
        ;;
    esac
  done > "$t5"

if [ -s "$t5" ]; then
  tab=$(printf '\t')
  while IFS="$tab" read -r kind path; do
    case "$kind" in
      marker)  fail "$path carries an unresolved scaffold-sync marker block - resolve it with resolving-scaffold-sync" ;;
      sidecar) fail "$path is a conflict sidecar: fix the path beside it, then delete the sidecar" ;;
    esac
  done < "$t5"
else
  pass "no unresolved scaffold-sync conflict in the tree"
fi
rm -f "$t5"

# ---- Summary ----
section "Summary"
if [ "$FAILS" -eq 0 ]; then
  printf '  scaffold verified clean.\n'
else
  printf '  %d check(s) failed.\n' "$FAILS"
fi

exit "$FAILS"

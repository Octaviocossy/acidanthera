# Spec: Glossary Compression Strategy

> Status: **settled**
> Created: 2026-09-11
> Grilled: 2026-09-11 — 4 rounds, 14 decisions
> Suggested next: /create-issue

## Goal

Cut `.agents/ubiquitous-language.md` from **194,800 B** to a governed **~68.5 KB**, and reduce
always-on agent context by **~90%**, by splitting the file into a five-file family, compressing
the row tail, and installing a budget with mechanical enforcement — so it cannot grow back, which
a *completed* cleanup in July already failed to prevent.

## Context: what was measured

| | |
|---|---|
| Size | 194,800 B · 454 lines · 28,608 words ≈ 50k tokens |
| Changelog | 74,175 B — **38%** of the file, 97 rows, self-declared non-authoritative |
| Reach | **72%** of every byte `CLAUDE.md` `@`-imports (269,757 B always-on), *and* in the corpus pack (~345 KB) handed to every Standards-axis reviewer process |
| Growth | 992 B (07-05) → 34,277 B (07-10) → 104,986 B (08-15) → **194,800 B (09-11)**; **+37.5 KB on 2026-09-10 alone** |
| Row shape | 158 definition rows, 78% of their bytes in the Notes column. Notes: mean 508, **median 293**, p75 617, p90 1,303, **max 3,842** (*Markdown walker*) |
| Precedent | `.agents/plans/2026-07-22-clean-domain-glossary.md`, status **completed** — it did this cleanup *and* wrote the anti-append rules into `domain-glossary.md`. The file grew ~6× after. **Prose rules alone have already been tried here and failed.** |
| Decay | Two `settled ahead of implementation` markers are stale for epics that landed (`Titlebar.tsx` is gone; `SidebarContextMenu.tsx` and `rename_entry` exist) |
| Coupling | Nothing parses the file; `verify-scaffold.sh` only checks that it exists |

Two findings reshaped the design mid-session and are recorded because they contradict the
recommendations that produced them:

1. **This is a tail problem, not an average problem.** The median Notes cell is already 293 B and
   correct. The damage is 21 rows (14%) over 1,200 B. A blanket "write shorter" rule would punish
   ~100 rows that are fine.
2. **Retirement as first framed fires on 1% of rows** (2 of 145). *"Aliases to avoid"* is a
   self-justifying column — 143 of 145 rows carry one because the table template asks for one, not
   because the alias tempts anyone. Any test treating it as evidence never fires. Retirement was
   re-based (decision 12) and demoted from "the answer to natural growth" to "the valve for the cap".

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | What is the binding constraint? | Agent **recall** first, context cost second, human readability third | A 50k-token glossary is not obeyed, so its authority is nominal. Only this ordering forces compression; under "cost only", relocation alone discharges the work and the 3,842-byte rows survive |
| 2 | Where does the Changelog go? | Moved **verbatim** to a sibling, excluded from the import *and* the corpus pack | It records *why* vocabulary changed and which recommendations were overruled — git reconstructs the diff, not that reasoning. But it is never authoritative, so it has no business being 38% of what every agent loads |
| 3 | Scaffold vs product vocabulary | **Split**, ~15.4 KB to its own file | It arrives via `/install-scaffold` and describes the harness, not acidanthera. Two owners editing one scaffold already produced a duplicate ADR number (`0034` exists twice) |
| 4 | Does a term ever leave? | **Yes**, on an explicit retirement test | Without a removal rule growth is unbounded by construction, and any cleanup is a one-time payment against a permanent trend |
| 5 | Loading | **Generated index always on; body on demand** | The always-on payload becomes a pointer table the model can actually hold. Dropping the import outright was the alternative; its failure mode is silent (nobody notices an agent did not read it), and the index also makes "does this term already exist?" cheap, which is what prevents duplicate vocabulary |
| 6 | Per-row budget | **600 B ceiling on the Notes cell + the one-claim rule** | 600 B is exactly where the tail starts (p75 = 617): reclaims ~25.2 KB from 41 rows and leaves the median 293-byte row untouched. The pairing mirrors what the repo already does — a semantic test in `adr.md`, mechanical checks in `verify-scaffold.sh` |
| 7 | New Changelog rows | **One line + a pointer** to the spec/ADR/issue | Mean 761 B → ~150 B. The essay already exists in the spec that produced it; the row's durable value is the pointer back to it, not a second copy |
| 8 | Vocabulary ahead of code | **Terms enter only when the code lands**; the marker convention dies | The glossary's own maintenance rule #1 says *describe current behavior*, which writing terms for unbuilt code directly violates — the marker existed to paper over that contradiction, and both markers in the file are stale. The sharpening benefit of defining a term during a grill is kept by landing it in the spec's `## Glossary Changes` |
| 9 | Where do the 56 invariants live? | **Extracted to their own file, permanently `@`-imported** | `standards-and-spec-review` makes a breach of them a **hard violation**, and they constrain all code rather than only code touching a given term. Under any other option the most enforcement-critical content becomes the least-loaded content |
| 10 | Enforcement | **Mechanical checks in `verify-scaffold.sh`** *and* the **Standards axis** at the review gate | The gate exists, runs mechanical checks already, and needs no GitHub access. The Standards axis comes nearly free and catches what a byte count cannot: a 400 B row that still restates its ADR instead of stating the distinction |
| 11 | Total cap | **Warn at 80 KB, hard-fail at 100 KB** | The warning gives notice during normal growth; the hard failure is the only mechanism here that forces a retirement decision rather than letting the file grow silently |
| 12 | Retirement, re-based | Aliases are **not** evidence. Retire when removing the row would not change what anyone writes: the canonical name is the only name the code uses, and no invariant cites the term. It is the **valve for the cap**, not a ritual | Measured: the first framing fired on 2 of 145 rows. Relocation and compression do the one-time work; retirement must exist or growth is unbounded, but it will be rare |
| 13 | File names | The **`ubiquitous-language-*.md` family** | `.agents/ubiquitous-language.md` is a scaffold-provided path — `verify-scaffold.sh` checks it, `build-corpus-pack.sh` names it, `/install-scaffold` copies it. Keeping the canonical name where upstream puts it stops this split from becoming a vendored divergence to reconcile on every scaffold update |
| 14 | ADRs | All three written: **0016, 0127, 0018** | Each passes `adr.md`'s three-part test independently |

## The resulting file set

| file | content | projected | loading |
|---|---|---:|---|
| `.agents/ubiquitous-language.md` | product vocabulary, compressed | ~68.5 KB | on demand |
| `.agents/ubiquitous-language-index.md` | term → area, one line each, **generated** | ~4 KB | **`@`-imported** |
| `.agents/ubiquitous-language-invariants.md` | invariants 1–38 (14,776 B, 9 over 600 B) | ~14.8 KB | **`@`-imported** |
| `.agents/ubiquitous-language-scaffold.md` | harness vocabulary (9,975 B) + invariants 39–56 (5,382 B) | ~15.4 KB | on demand |
| `.agents/ubiquitous-language-changelog.md` | 97 rows verbatim | ~74.2 KB | neither |

**Always-on context: 194,800 B → ~18,800 B (index + invariants), a ~90% cut.**
**Corpus pack: ~345 KB → ~249 KB per Standards reviewer** (the changelog leaves it).
**Vocabulary file: −65%.**

Derived, not separately decided:

- The **600 B ceiling applies to an invariant too** — 47 of 56 already comply, so one number covers both files.
- The **index must be checked in**. `@` imports a path and cannot run a script, so the index is
  generated *and* verified by `verify-scaffold.sh` — the corpus pack's anti-staleness trick
  (ADR 0008) adapted to a file that has to persist.
- `.agents/rules/domain-glossary.md` is **rewritten**, not amended: decision 8 reverses its
  *"Write inline, never batched"* section outright.

## Files that change outside the five

`CLAUDE.md` (import swap) · `.agents/rules/domain-glossary.md` (rewritten) ·
`.agents/rules/design-interrogation.md` (resolved terms land in the spec) ·
`.agents/scripts/build-corpus-pack.sh` (source list) · `.agents/scripts/verify-scaffold.sh` (new
checks) · a new index-generator script · the **`/grill` command triad** — all three files, per
invariant 39 · `AGENTS.md` · `.agents/skills/standards-and-spec-review/SKILL.md` (its source list
must stay in sync with the corpus-pack script) · `.agents/skills/resolving-merge-conflicts/SKILL.md` ·
`.agents/rules/parallel-orchestration.md` · `.agents/commands/review-branch.md` · `README.md` ·
`CONTRIBUTING.md` · `doc/tech-stack.md` · `.agents/scaffold.manifest`.

The two stale markers are deleted by the pass.

## Explicitly Out of Scope

- **Moving or renaming `.agents/ubiquitous-language.md` itself.** It is the one path the scaffold
  hard-codes; a `.agents/language/` directory was considered and rejected for that reason alone.
- **Deleting Changelog content.** It relocates verbatim. A later retention policy is a separate decision.
- **Aggressive retirement** — retiring every term not cited by an invariant or a Flagged ambiguity.
  Rejected: it deletes vocabulary that is quietly load-bearing, and nobody notices until two agents
  name the same thing differently.
- **Rewriting the ~104 rows already under 600 B.** They are correct; the budget targets the tail.
- **Fixing the duplicate ADR number `0034`.** Real, found here, and not this work.
- **Any change under `src/` or `src-tauri/`.** This is governance-only.
- **The corpus pack's stale-glossary behaviour** (it is built from `main`, so an epic child's
  Standards axis can judge against an out-of-date glossary). Known separately; untouched here.

## Glossary Changes

Per decision 8, terms are recorded here and promoted when the code lands. All five are **scaffold
vocabulary** and belong in `.agents/ubiquitous-language-scaffold.md`, not the product glossary.

| Term | Definition |
|---|---|
| Glossary index | The generated, always-`@`-imported table mapping every canonical term to the area that defines it, one line each. A pointer table, never a summary: it carries no definition, so it cannot disagree with the body. Regenerated and verified by `verify-scaffold.sh`, never hand-edited |
| One-claim rule | A glossary row states what the term **is**, its canonical type, and the one distinction that would otherwise be got wrong. Rationale belongs to the ADR the row cites. The semantic half of the budget; the 600 B ceiling is the mechanical half |
| Glossary budget | 600 B per Notes cell, warn at 80 KB and fail at 100 KB on the vocabulary file. A budget rather than a guideline: exceeding it fails the scaffold gate, which is what forces a retirement decision instead of silent growth |
| Retirement test | A term is retired when removing its row would not change what anyone writes — the canonical name is the only name the code uses, and no invariant cites the term. *Aliases to avoid* is explicitly **not** evidence: 143 of 145 rows carry one because the template asks for one |
| Scaffold vocabulary | Terminology describing the cross-agent harness rather than the product — the review gate, epic orchestration, issue labels, the command triad. Arrives via `/install-scaffold` and is separately owned, so an upstream update never merges into product vocabulary |

## ADRs Raised

- `.agents/adr/0016-always-on-is-the-index-and-the-invariants.md` — the glossary body is read on demand
- `.agents/adr/0127-vocabulary-enters-when-the-code-lands.md` — reverses *write inline, never batched*
- `.agents/adr/0018-the-glossary-has-a-byte-budget.md` — ceiling, cap, and retirement as the valve

## Residual Unknowns

- **The ~68.5 KB projection is an estimate.** The 25,239 B reclaim at 600 B was measured across all
  145 rows *including* scaffold ones, so the product-only reclaim (~22 KB) is inferred. Re-measure
  after the pass and set the thresholds against the real number.
- **80 KB / 100 KB are first thresholds, not proven ones.** They give ~17% and ~46% headroom over
  the projection. Revisit once one epic has landed under the new regime.
- **The index format is not specified to the byte** — the generator decides column shape at
  implementation time, constrained only by "one line per term, no definitions".
- **Duplicate ADR number `0034`** (`0120-sidebar-hover-reveal-is-app-drawn.md` and
  `0119-vault-root-is-canonical-at-the-boundary.md`). Out of scope, needs its own fix.

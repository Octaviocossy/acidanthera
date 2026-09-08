# Vendored artifacts carry no attribution; ADRs record the divergence

Skills and commands vendored from elsewhere keep the upstream body verbatim but carry **no
attribution footer** — the body is procedure, and a credit line at the foot of it is not something
the agent executing the procedure needs. Provenance and every deliberate divergence from upstream
are recorded here instead, which is where `.agents/rules/adr.md` already puts decisions that
outlive the task.

## Consequences

Without a footer, an ADR is the *only* way to reconcile a future upstream update: it is what
distinguishes what we changed on purpose from what upstream changed. So a vendored artifact that
diverges must be recorded, with the upstream path and the pinned commit.

## Vendored artifacts and their divergences

**`.agents/skills/standards-and-spec-review/`** — from `mattpocock/skills`,
`skills/engineering/code-review/SKILL.md` @ `84fdeff`. Two divergences:

1. **Renamed.** Upstream calls it `code-review`. Claude Code ships a built-in skill of that exact
   name, and `.agents/rules/skill-creation.md` requires `name` to equal the directory name (checked
   by `verify-scaffold.sh` §8), so keeping the upstream name would collide head-on. The
   `description` was rewritten for the same reason — it is the only text an agent matches on, so it
   now leads with this repo's trigger and explicitly cedes correctness-bug hunting to the built-in.
2. **One line replaced.** Upstream's *"run `/setup-matt-pocock-skills` if
   `docs/agents/issue-tracker.md` is missing"* names a command and a file that do not exist here;
   left in place it invites the agent to run something broken. It now points at the GitHub MCP
   server and `.agents/rules/issue-resolution.md`.

**`.agents/commands/handoff.md`** — from `mattpocock/skills`,
`skills/in-progress/claude-handoff/SKILL.md` (upstream marks it *in-progress*, i.e. unstable).
Upstream ships it as a skill with `disable-model-invocation: true`; per `skill-creation.md` a
procedure that must never auto-load belongs in `.agents/commands/`, so it is a **command** here and
the `claude-` prefix is dropped for cross-agent parity. Upstream's instructions —
summary-becomes-prompt, mandatory `--name`, a suggested-skills section, reference-don't-duplicate,
redaction, `$ARGUMENTS` as the next session's focus — are preserved. The `## Launcher` table, the
argument-order invariants, the two guards, the sandboxed default, the confirmation step, and the
`/execute-epic` boundary are local.

**`.agents/skills/resolving-merge-conflicts/`** — from `mattpocock/skills`,
`skills/engineering/resolving-merge-conflicts`. No divergence: steps 1–5 are upstream verbatim and
everything local lives in `## In this repository`.

**`.agents/skills/acidanthera-design/`** — from Claude Design project
`d333dc32-6b35-4f89-9982-66bbc1014fcb`, *Orbit Design System*. Six divergences: three from the
rebrand (#134), three from the unified sidebar and chrome strip (#141, landed by #147). This is the
most heavily diverged vendored artifact here, and deliberately so — it encodes a design system that
has kept moving since it was vendored, and a reviewer loads it to check UI work, so a stale clause
in it is worse than a divergence recorded here.

1. **Renamed.** Vendored as `orbit-design`; renamed with the product, since
   `.agents/rules/skill-creation.md` requires `name` to equal the directory name (checked by
   `verify-scaffold.sh` §8) and the design system it encodes is now `acidanthera`. The `# Orbit
   Design System` heading, the `description`, and the invariant-22 reference moved with it.
2. **The accent rule carries this repository's exemptions, not upstream's blanket ban.** Upstream's
   `## Accent discipline` forbids the ember for branding outright, which is what invariant 21 said
   when this was vendored. It then tracked ADR 0032, which carved out the one artifact that never
   renders inside the window — the app icon and the favicon. **ADR 0036 has since superseded 0032**
   with a broader test: the brand mark is *identity rather than signal*, so it sits outside the
   accent system entirely and its ember ring renders wherever the mark renders, in-app included.
   The clause now states 0036's rule and cites it. The permitted list also names the dirty-note dot
   and, at disabled opacity, an AI action offered but not yet available — both reconciled from the
   glossary's *AI accent* row rather than invented here.
3. **Attribution footer removed.** The body carried a trailing *"Vendored from Claude Design
   project `d333dc32-…` (Orbit Design System)"* line. This ADR's whole rule is that a vendored body
   carries no such footer, so it is deleted and its provenance is the entry you are reading.
4. **Surfaces repointed.** Upstream describes `--bg-panel` as "side panels and status" and
   `--bg-surface` as "title bars and modal bases". There has been no status surface since ADR 0009
   and no title bar since ADR 0035, so both descriptions named things that do not exist;
   `--bg-panel` is now also the *inset card*'s ground.
5. **Iconography and the component inventory replaced.** Upstream's hand-tuned-SVG rule and its
   *"do not add an icon dependency"* line contradict **ADR 0017** — every drawn icon comes from
   Lucide through the `Icon` primitive, with `AcidantheraMarkGlyph` the only survivor. The
   inventory dropped `Badge` (deleted once it had no consumer) and gained `Modal`, `Icon` and
   `Tooltip`.
6. **A `## Layout and chrome` section was added**, with no upstream counterpart: it carries the
   rules a reviewer needs that ADR 0035 introduced — the *chrome strip*, "no titlebar and no
   status bar", every global control living in the sidebar, the *primary nav* as the one surface
   rendering a chord persistently rather than on hover, and invariant 31's no-chord-literals rule.
   The *inset card*'s hairline-never-shadow rule went into the **existing** `## Motion and
   elevation` section instead, beside upstream's own hairlines-not-shadows guidance, which is the
   rule it qualifies.

The upstream project title stays *Orbit Design System* here: it names an external artifact, and
renaming it would falsify the provenance this ADR exists to preserve. That is why the citation
lives in this ADR rather than in the body that moved with the product.

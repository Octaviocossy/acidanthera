# The `acidanthera-design` skill diverges from its upstream

ADR-0003 rules that a vendored body carries no attribution footer and that every deliberate
divergence from upstream is recorded in an ADR instead. ADR-0003 is itself delivered and rewritten by
the scaffold sync, so this project's own vendored skill is recorded here, in a file the project owns,
rather than appended to a file it does not.

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
   when this was vendored. It then tracked ADR 0117, which carved out the one artifact that never
   renders inside the window — the app icon and the favicon. **ADR 0122 has since superseded 0032**
   with a broader test: the brand mark is *identity rather than signal*, so it sits outside the
   accent system entirely and its ember ring renders wherever the mark renders, in-app included.
   The clause now states 0036's rule and cites it. The permitted list also names the dirty-note dot
   and, at disabled opacity, an AI action offered but not yet available — both reconciled from the
   glossary's *AI accent* row rather than invented here.
3. **Attribution footer removed.** The body carried a trailing *"Vendored from Claude Design
   project `d333dc32-…` (Orbit Design System)"* line. This ADR's whole rule is that a vendored body
   carries no such footer, so it is deleted and its provenance is the entry you are reading.
4. **Surfaces repointed.** Upstream describes `--bg-panel` as "side panels and status" and
   `--bg-surface` as "title bars and modal bases". There has been no status surface since ADR 0107
   and no title bar since ADR 0121, so both descriptions named things that do not exist;
   `--bg-panel` is now also the *inset card*'s ground.
5. **Iconography and the component inventory replaced.** Upstream's hand-tuned-SVG rule and its
   *"do not add an icon dependency"* line contradict **ADR 0115** — every drawn icon comes from
   Lucide through the `Icon` primitive, with `AcidantheraMarkGlyph` the only survivor. The
   inventory dropped `Badge` (deleted once it had no consumer) and gained `Modal`, `Icon` and
   `Tooltip`.
6. **A `## Layout and chrome` section was added**, with no upstream counterpart: it carries the
   rules a reviewer needs that ADR 0121 introduced — the *chrome strip*, "no titlebar and no
   status bar", every global control living in the sidebar, the *primary nav* as the one surface
   rendering a chord persistently rather than on hover, and invariant 31's no-chord-literals rule.
   The *inset card*'s hairline-never-shadow rule went into the **existing** `## Motion and
   elevation` section instead, beside upstream's own hairlines-not-shadows guidance, which is the
   rule it qualifies.

The upstream project title stays *Orbit Design System* here: it names an external artifact, and
renaming it would falsify the provenance this ADR exists to preserve. That is why the citation
lives in this ADR rather than in the body that moved with the product.

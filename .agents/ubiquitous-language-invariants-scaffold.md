# Ubiquitous Language — Scaffold Invariants

> Every invariant the harness itself commits to. A breach of one is a **hard violation** at the
> review gate. **Owned and updated by the scaffold.** A project must not edit this file; its own
> invariants belong in `.agents/ubiquitous-language-invariants.md`.
> Each invariant carries a permanent identifier — `S` and a number — assigned once in order of
> arrival and never renumbered or reused (S21). Cite one by its identifier, e.g. `S12`.
>
> **Last updated:** 2026-09-13
> **Budget:** notes 600 · warn 12288 · fail 16384 (bytes)

---

## Invariants and relationships

- **S1. A command triad moves as a unit.** Renaming, adding, or deleting a slash command touches
  all three of its files in the same change; a partial triad fails the acceptance gate.
- **S2. A review finding is a hard violation only if it breaches the glossary or an ADR.** Everything
  the Fowler smell baseline surfaces is a judgement call, no matter how confident the reviewer is.
  A documented repo standard overrides the baseline where the two disagree.
- **S3. The Standards axis and the Spec axis are never merged or reranked against each other.** A
  change can pass one and fail the other; combining them lets the passing axis mask the failing
  one.
- **S4. Axis isolation is blindness between findings, never exclusivity over sources.** The Standards
  and Spec sub-agents may be handed the same pre-read source material; what they must never see is
  each other's findings or a merged ranking of them.
- **S5. The runner is the sole writer of the epic integration branch, on both execution paths.** A
  review gate changes *when* a child is merged, never *who* merges it — the agent only reads epic
  branch state and opens the final PR.
- **S6. Review state is derived from git, never stored.** A child awaits review if its remote branch
  exists and the epic branch carries no `Merge child #N` for it; rework rounds are counted from
  commit markers. There is no durable state file to disagree with the repository.
- **S7. Every child passes an agentic review before it can be integrated, on both execution paths.**
  What differs is who resolves a finding: on the supervised path a hard violation pre-selects
  rejection and the human decides; on the auto path it blocks integration and triggers rework
  directly. Never whether the review runs.
- **S8. Both execution paths run one pipeline.** Run → review → optional rework → integrate. No path
  has a shortcut that merges without review — that is what removing the inline merge bought.
- **S9. Every source a reviewer needs arrives by path, already materialized.** The corpus pack, the
  issue body, the plan, the design spec and the diff are all written to disk *before* the review
  prompt is built, on both paths. A reviewer sent to *find* a source has an unbounded search
  space, and the observed failure is not that it costs more but that it reads less and reports
  shallowly — or never returns. A wall-clock cap (`REVIEW_TIMEOUT` per reviewer attempt,
  `AGENT_TIMEOUT` per implementing agent) exists to catch that, never to make it tolerable.
- **S10. A review gate never emits a merged verdict.** It presents both axes side by side and one
  objective **gate line** counting hard violations and judgement calls. Counting is not
  reranking; the moment a gate collapses the two axes into a single approve/reject, the passing
  axis starts masking the failing one.
- **S11. Work is not done until an agentic review has seen it.** Under an epic that means before
  integration; interactively it means after the acceptance criteria pass and before
  `/execute-issue` reports completion. What varies across paths is who resolves a finding, never
  whether the review runs — with exactly one declared exception: `skip review` on the interactive
  path, which a human chooses at the call site and which must be stated in the final report. No
  path may skip the review by omission, by configuration, or silently.
- **S12. A review report is an artifact, never review state.** Persisting one does not contradict
  "review state is derived from git": nothing reads a report back to decide what stage a change is
  at. The moment something did, the file could disagree with the repository — which is the
  failure ADR-0005 exists to prevent.
- **S13. A rejection triggers rework; a merge conflict does not.** A conflict is an integration
  problem and goes to guided recovery in the child's direction; rework is for "this is not what I
  asked for."
- **S14. An issue label is informational; nothing in the pipeline reads one back.** Neither execution
  path, the runner, nor the review gate branches on a label. The moment one did, GitHub would
  become a source of execution state that can disagree with the repository — which is exactly
  what "review state is derived from git, never stored" exists to prevent.
- **S15. Labels are written at creation and corrected only by `/update-issue`.** `/create-issue` and
  `/spec-breakdown` set them; `/update-issue` may fix them, because correcting an inaccurate
  generation is what that command is for. `/ship-note`, `/comment-issue`, `/execute-issue` and
  `/handoff` still never send labels.
- **S16. Applying a label is best-effort and never blocks issue creation.** A decorative metadatum must
  not be able to stop the issue from existing — and GitHub already behaves this way, silently
  dropping labels from a token without push access rather than failing the request.
- **S17. A child never inherits its epic's labels.** Every issue is labelled from its own content;
  propagating the epic's labels down would give every child the same set and destroy the filter's
  value. The `> Epic: #<n>` body header is what groups them.
- **S18. The shape of a session is chosen at the call site, never in `.agents/parallel.config`.** That
  file is gitignored and per-machine, so it may hold operational knobs (concurrency, timeouts,
  caps) but nothing that decides whether a human is required.
- **S19. A scaffold sync never writes through a symlink, into a directory, or over one — at any
  component beneath the target root.** It replaces a link rather than following it, refuses to
  deliver over a directory, marks a divergence it cannot mark in place beside the path, and refuses
  every path beneath a non-directory ancestor before reading it — the whole run, when that
  ancestor is `.agents`, where the baseline lives. Reversing *never overwrites* (ADR-0019) is only
  safe under this rule: the sync may rewrite what the manifest says the scaffold authors, never
  what a path merely points at.
- **S20. Every artifact is written in English, whatever language the work was discussed in.** The
  conversation follows the user's language; the artifact never does. A phrase the user said in
  another language is paraphrased, never pasted — quoted verbatim only when the exact wording is
  itself the subject, such as an alias to avoid. There is no bilingual exception: a translation
  beside an English source is still an artifact in the wrong language.
- **S21. A scaffold invariant's identifier is permanent.** An identifier is assigned once, in
  order of arrival, and is never renumbered, reordered into a different meaning, or reused after
  retirement. Consumers cite invariants by identifier across a sync, so renumbering upstream would
  silently change what every downstream citation means.

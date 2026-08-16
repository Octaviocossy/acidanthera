# Label Taxonomy

The labels this project attaches to its GitHub issues. Read by `.agents/scripts/sync-labels.sh`
and by `/create-issue`, `/spec-breakdown` and `/update-issue`.

Labels here are **informational**: nothing in the execution pipeline reads one back
(`.agents/adr/0031-issue-labels-are-informational.md`).

## Closed facet: `type:`

Enumerated — an issue-creating command may only pick a value from this block. The values mirror
the Conventional Commits prefixes `/create-issue` already requires in the title, so the type of
work becomes filterable instead of living only inside title text.

```labels
type:feat        0e8a16  A new capability
type:fix         d73a4a  A defect repair
type:chore       cfd3d7  Maintenance with no user-visible behavior change
type:docs        0075ca  Documentation only
type:refactor    a2eeef  Behavior-preserving restructuring
type:test        fbca04  Tests only
type:epic        5319e7  A tracking issue with child issues; do not implement here
```

## Open facet: `area:`

Declared, never enumerated. Its values are project-specific and this scaffold is stack-neutral,
so it ships the mechanism rather than the vocabulary. `sync-labels.sh` deliberately does **not**
provision `area:` — doing so would close the facet.

- Format: `area:` plus one kebab-case segment (`area:auth`, `area:review-gate`).
- Derived from the issue's `## Affected Files` section.
- **Reuse before invent:** list the repo's existing labels first and reuse a matching `area:`
  value; only create a new one when none genuinely covers the issue. Without this rule
  `auth`, `authentication` and `auth-flow` become three labels for one thing.
- A newly invented value is created with color `ededed`.

## Rules

- **Maximum 3 labels per issue.** Room for `type:` + `area:` + one more that genuinely earns it.
- **Exactly one `type:` per issue.**
- **Every label is `facet:value`.** There are no bare-word labels, `type:epic` included.
- **A child never inherits its epic's labels** — every issue is labelled from its own content.
  The `> Epic: #N` body header is what groups them.
- Applying a label is **best-effort**: a failure is reported and never blocks issue creation.

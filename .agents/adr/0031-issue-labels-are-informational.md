# Issue labels are informational; the pipeline never reads them

`/create-issue` and `/spec-breakdown` attach labels to the issues they create so a human can
recognise and filter them in the GitHub UI. Nothing on either execution path — `/execute-epic`,
`/supervise-epic`, `.agents/scripts/run-parallel-issues.sh`, or the review gate — ever branches
on a label: the frontier is computed from the epic branch's commit history and from the
`> Epic:` / `> Depends on:` headers in each issue body, exactly as before.

## Considered Options

Letting the pipeline read labels is the obvious next suggestion — `/execute-epic` filtering
children by `type:`, or the review gate weighting a finding by area — and it was rejected. A
label is editable by anyone with push access, from a UI that knows nothing about the run in
progress. Reading one back would make GitHub a source of *execution* state that can silently
disagree with the repository, which is precisely what ADR-0021 (review state is derived from
git, never stored) exists to prevent. Labels are cheap because nothing depends on them; the
moment something does, they stop being cheap.

## Consequences

Applying a label is best-effort: a failure is reported but never blocks issue creation, and
GitHub already behaves this way, silently dropping labels from a token without push access. A
missing or wrong label therefore degrades discoverability and nothing else — no run stalls, no
child is skipped, and no rework round is triggered by one.

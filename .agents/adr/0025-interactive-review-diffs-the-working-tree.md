# The interactive review diffs the working tree, not `<fixed-point>...HEAD`

`/execute-issue` is working-tree only — it never commits — so its output is invisible to the
three-dot diff every other review in this repo uses. The interactive review gate therefore
compares two-dot against the **merge base** (`git diff $(git merge-base <fixed-point> HEAD)`,
after `git add -N .` so untracked files enter the diff), which is the only form that can see
uncommitted work.

The merge base, not the fixed point directly: `git diff <fixed-point>` would render everything
the fixed point gained since the branch was cut as spurious *reversed* changes. This is the same
problem three-dot exists to solve, and the working-tree form has to solve it too — so the form is
the working-tree analogue of three-dot, and a superset of it.

## Considered Options

- **Commit before reviewing.** Rejected: it would break `/execute-issue`'s documented
  working-tree-only contract and take from the user the decision of what to commit.
- **A temporary throwaway commit.** Rejected: it puts history manipulation inside a command
  that promises not to touch history, and leaves debris if the session is interrupted.

## Consequences

`.agents/ubiquitous-language.md` › Fixed point no longer asserts "always three-dot" — the
comparison form now follows what is under review. `/review-branch committed-only` opts back
into the three-dot form when the caller wants the branch as pushed, ignoring local edits.

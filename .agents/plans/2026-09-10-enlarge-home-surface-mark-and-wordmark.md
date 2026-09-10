# Plan: Enlarge the home surface's mark and wordmark, and drop the redundant greeting

> Status: **completed**
> Created: 2026-09-10
> Updated: 2026-09-10
> Issue: — (no GitHub issue; lands on the epic branch of #149 before PR #156 merges)

## Goal

Make the brand mark and the `acidanthera` wordmark substantially larger on the *home surface*, and
stop rendering the `No note open.` greeting in the one state where it states the obvious — a vault
that has notes.

## Context

**What exists today.** `src/components/layout/HomeSurface.tsx` renders, centered in the *inset
card*: `AcidantheraMarkGlyph` at its default **24×28**, the wordmark at `text-display` (**26px**),
a greeting at `text-h1` (20px), and — given a vault — the `Everything stays local …` subtitle. The
greeting is one string chosen from three by state:

```tsx
const greeting = !hasVault ? 'No vault open.' : isEmptyVault ? 'Your vault is empty.' : 'No note open.';
```

**Why this is not a two-line component tweak.** Both size changes reach past the design system as
it stands:

- `--font-size-display: 26px` is the **top** of the type scale in
  `src/styles/tokens/typography.css`. There is no larger step. The `acidanthera-design` skill
  requires sizes to come from that semantic scale and forbids introducing parallel values, so a
  40px wordmark needs a **new scale step**, not an arbitrary `text-[40px]`.
- `AcidantheraMarkGlyph` (`src/components/vault/glyphs.tsx`) hardcodes `width="24" height="28"`
  and accepts only `className` — there is no `size` prop.

**The precedent for resizing the mark already exists.** `Sidebar.tsx:518` (the *sidebar rail*'s
brand mark) overrides the glyph's intrinsic size with `className="h-[18px] w-[16px] …"`. CSS
`width`/`height` beat SVG presentation attributes, so this works without touching the glyph. This
plan follows that precedent rather than adding a prop, which would mean changing a component with
four call sites for the benefit of one.

**Trigger.** Direct user request: *"let's make more big the acidanthera title and the logo on the
home screen and delete the 'No note open' paragraph."* Sizing target and greeting scope were
settled with the user before this plan was written — see Architecture Decisions.

**Constraint — where this lands.** `HomeSurface` exists **only** on
`epic/149-home-surface-and-agent-dock`; it is not on `main`. PR #156 is open and mergeable. The
user chose to land this **on the epic branch before #156 merges**. See Architecture Decisions for
what that costs and the compensating verification this plan requires.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/styles/tokens/typography.css` | Add `--font-size-hero: 40px` above `--font-size-display` |
| MODIFY | `src/styles/index.css` | Map `--text-hero` into Tailwind's font-size namespace |
| MODIFY | `src/components/layout/HomeSurface.tsx` | Enlarge mark and wordmark; make the greeting conditional |
| MODIFY | `src/components/layout/HomeSurface.test.tsx` | Assert the greeting is **absent** in the with-notes state |
| MODIFY | `.agents/ubiquitous-language.md` | Amend the *Home surface* row; add a Changelog row |

No other file changes. `glyphs.tsx` is deliberately **not** modified.

## Step-by-Step Implementation

### Step 1 — Add the `hero` step to the type scale

- **File:** `src/styles/tokens/typography.css`
- **Action:** MODIFY
- **Details:** In the `--font-size-*` block, add one line immediately **after**
  `--font-size-display: 26px;`, keeping the block's ascending order:
  ```css
  --font-size-display: 26px;
  --font-size-hero: 40px;
  ```
  Change nothing else in the file. Do **not** add a `--tracking-hero`: `--tracking-display`
  (`-0.02em`) is relative to font size, so it tightens proportionally at 40px, which is the
  behavior wanted at display sizes.
- **Why:** The scale stops at 26px, and `acidanthera-design` requires sizes to come from the
  semantic scale rather than a one-off value.

### Step 2 — Expose it to Tailwind

- **File:** `src/styles/index.css`
- **Action:** MODIFY
- **Details:** In the `@theme` block where the other font sizes are mapped (currently ending at
  `--text-display`), add one line after it, preserving the existing order:
  ```css
  --text-display: var(--font-size-display);
  --text-hero: var(--font-size-hero);
  ```
  This makes the `text-hero` utility available. Do not touch the `--tracking-*` lines below it.
- **Why:** Tailwind's `--text-*` namespace is what turns a token into a utility class; without
  this, `text-hero` silently does nothing.

### Step 3 — Enlarge the mark

- **File:** `src/components/layout/HomeSurface.tsx`
- **Action:** MODIFY
- **Details:** At line ~106, change:
  ```tsx
  <AcidantheraMarkGlyph className="text-text-secondary" />
  ```
  to:
  ```tsx
  <AcidantheraMarkGlyph className="h-[65px] w-[56px] text-text-secondary" />
  ```
  Leave the surrounding comment (about the ember ring being identity rather than accent) intact.
  Do **not** add a `size` prop to `AcidantheraMarkGlyph` and do **not** edit `glyphs.tsx`.
- **Why:** 56×65 is ~2.3× the intrinsic 24×28, the size the user selected. The className override
  is the pattern `Sidebar.tsx:518` already uses for the rail's mark. The glyph's `viewBox` keeps
  `preserveAspectRatio` at its default (`xMidYMid meet`), so the 0.5% difference between 56:65 and
  the intrinsic 24:28 letterboxes rather than distorting — the mark renders undistorted and
  centered in the box.

### Step 4 — Enlarge the wordmark

- **File:** `src/components/layout/HomeSurface.tsx`
- **Action:** MODIFY
- **Details:** At line ~107, change `text-display` to `text-hero`:
  ```tsx
  <span className="font-sans text-hero font-medium text-text-primary tracking-display">acidanthera</span>
  ```
  Keep `font-medium` (weight 500 — `acidanthera-design`: headings stop at 500) and
  `tracking-display` unchanged.
- **Why:** Consumes the token added in Steps 1–2 rather than an arbitrary value.

### Step 5 — Drop the greeting in the with-notes state

- **File:** `src/components/layout/HomeSurface.tsx`
- **Action:** MODIFY
- **Details:** Change the greeting derivation at line ~58 so the third state yields no string:
  ```tsx
  // A vault with notes gets no greeting: `No note open.` only restates the surface you are already
  // looking at. The other two states name a condition you can act on, so they keep theirs.
  const greeting = !hasVault ? 'No vault open.' : isEmptyVault ? 'Your vault is empty.' : null;
  ```
  Then guard its render at line ~109:
  ```tsx
  {greeting !== null && <span className="font-sans text-h1 text-text-primary">{greeting}</span>}
  ```
  Leave the enclosing `<div className="flex flex-col items-center gap-1.5">` and the `hasVault`
  subtitle exactly as they are. In the with-notes state that wrapper then holds only the subtitle,
  where `gap-1.5` is inert.
- **Why:** The user's request, scoped to the one state where the line is redundant. The no-vault
  and empty-vault greetings name a condition the user can act on and are kept.

### Step 6 — Update the test for the with-notes state

- **File:** `src/components/layout/HomeSurface.test.tsx`
- **Action:** MODIFY
- **Details:** In the test currently named
  `'greets a vault that has notes, and relabels the create row without changing its command'`
  (line ~67), replace the positive greeting assertion at line ~72:
  ```tsx
  expect(screen.getByText('No note open.')).toBeInTheDocument();
  ```
  with a negative one, and rename the test since it no longer greets:
  ```tsx
  it('renders no greeting for a vault that has notes, and relabels the create row without changing its command', () => {
    useSidebarStore.setState({ tree: [note] });

    render(<HomeSurface />);

    // `No note open.` only restated the surface itself; the other two states keep their greeting.
    expect(screen.queryByText('No note open.')).not.toBeInTheDocument();
    expect(screen.getByText(/Everything stays local/)).toBeInTheDocument();
    …existing row assertions unchanged…
  });
  ```
  Leave the two other state tests (lines ~43 and ~55) untouched — they still assert
  `No vault open.` and `Your vault is empty.`, and both must keep passing.
- **Why:** The suite currently asserts the string this change removes, so it would fail otherwise.
  The added `Everything stays local` assertion proves the subtitle survived the greeting's removal
  rather than the whole wrapper disappearing.

### Step 7 — Amend the glossary

- **File:** `.agents/ubiquitous-language.md`
- **Action:** MODIFY
- **Details:**
  - In the **Home surface** row, which currently reads *"the brand mark over the wordmark, a
    greeting, three home rows, and the agent dock"*, record that the greeting is present only in
    the no-vault and empty-vault states — a vault with notes has none, because `No note open.`
    only restated the surface. Keep the "differing only in greeting and row set (invariant 33)"
    clause: an absent greeting is still a greeting difference, so invariant 33 is unchanged and
    must **not** be edited.
  - Add a Changelog row dated **2026-09-10** covering both changes: the new `--font-size-hero`
    step (40px, the first above `display`), the mark at 56×56-boxed-65 on the home surface via the
    `Sidebar.tsx:518` className precedent, and the dropped third-state greeting.
  - `Last updated` already reads `2026-09-10` on this branch — **verify** with
    `grep -n "Last updated" .agents/ubiquitous-language.md` and leave it alone if so.
- **Why:** `.agents/rules/domain-glossary.md` requires the glossary to describe **current
  behavior** and to gain a Changelog row whenever canonical behavior changes. Five of epic #149's
  six rework rounds were caused by exactly this omission, so it is a step rather than an
  afterthought.

### Step 8 — Verify

- **Details:** Run the full gate from the repository root:
  ```sh
  pnpm check && pnpm build && pnpm test
  ```
  Then launch the app (`pnpm dev`) and confirm the Validation Criteria below by eye — in
  particular the short-window check, which no test covers.
- **Why:** `--rework` and `--integrate` in the parallel runner do not run the acceptance gate
  (see Architecture Decisions), and this change lands on the epic branch outside the child review
  pipeline, so verification is manual by necessity.

## Architecture Decisions

- **A new type-scale step, not a one-off value.** `--font-size-display: 26px` is the top of the
  scale, and `acidanthera-design` says to use the semantic scale and not to introduce parallel
  values. `--font-size-hero` continues the scale's role-based naming (`h2`, `h1`, `display`) at the
  next step up. `--font-size-brand` was considered and rejected: the scale names by size-role, not
  by the component that happens to consume it — that is the *radius* ladder's convention, not this
  one.
- **The mark is resized at the call site, not given a prop.** `AcidantheraMarkGlyph` has four call
  sites; only this one changes. `Sidebar.tsx:518` already establishes the className override as the
  way to resize it, so following that keeps one pattern instead of introducing a second.
  `glyphs.tsx` stays untouched, which also keeps the app icon, favicon, sidebar brand row and
  footer identity tile at their current sizes.
- **The greeting is dropped for one state, not deleted outright** (user's decision). `No vault
  open.` and `Your vault is empty.` each name a condition the user can act on; `No note open.`
  restates the surface being looked at. Removing the element entirely was offered and declined.
- **This lands on the epic branch before PR #156 merges** (user's decision), rather than as a
  follow-up on `main`. **The trade-off, recorded so no reviewer reads it as an oversight:** #156's
  body and the six child ship-notes describe work that passed a two-axis agentic review and a
  human gate per child. This change gets neither — it is not a child issue, so the runner's
  `--review` pipeline does not apply to it. Step 8's manual gate is the compensation. Consider
  running `/review-branch` on the epic branch before merging #156 if you want the two-axis review
  applied to it; that is a judgement call, not a requirement of this plan.
- **`tracking-display` is reused rather than given a `hero` variant.** `-0.02em` is font-relative,
  so it already tightens proportionally at 40px, which is the desired behavior at display sizes.

## Validation Criteria

- [x] `pnpm check` passes (biome lint + format).
- [x] `pnpm build` passes (`tsc` + vite).
- [x] `pnpm test` passes, including the three `HomeSurface` state tests.
- [x] `grep -rn "text-\[" src/components/layout/HomeSurface.tsx` returns nothing — the wordmark
      uses the token, not an arbitrary value.
- [x] **No vault:** mark and wordmark are visibly larger; `No vault open.` still renders; only the
      `Open an existing vault` row shows; no subtitle; no dock.
- [~] **Empty vault:** `Your vault is empty.` still renders, with the `Everything stays local …`
      subtitle beneath it. **Not observed live** — producing this state means repointing the vault,
      which would rewrite the user's `settings.toml`. Covered by the passing unit test that asserts
      both the greeting and the `displayPath` subtitle; its layout is the with-notes state plus one
      `text-h1` line, which the 600px capture leaves ~20px of clearance for.
- [x] **Vault with notes:** **no greeting line**; the `Everything stays local …` subtitle renders
      directly under the wordmark; all three rows present.
- [x] The mark is undistorted (a regular hexagon, not stretched) and its ember ring still renders.
- [x] **Short-window check:** at a window height around 600px, the mark/wordmark/rows block does
      not overlap or clip against the dock's reserved 124px slot. The centering container is
      `flex min-h-0 flex-1`, so it shrinks rather than pushing the dock off — confirm the content
      is still legible and, if it crowds, report back rather than silently reducing the sizes.
- [x] The sidebar's brand row, the footer identity tile and the collapsed rail's mark are all
      **unchanged in size** — proof that resizing at the call site did not leak.

## Open Questions

None. Sizing (mark 56×65, wordmark 40px), greeting scope (third state only), and target branch
(the epic branch, before #156 merges) were each settled with the user before this plan was written.

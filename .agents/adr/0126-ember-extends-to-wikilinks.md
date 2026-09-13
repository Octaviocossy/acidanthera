# The ember accent extends to wikilinks

ADR 0105 gave the ember accent exactly one meaning — *the AI acted here* — and every artifact since
has enforced it: `doc/v0-spec.md` §5.6 specified wikilinks as "underline + hover, no color",
`wikilink.ts` carried the comment "never accented", and invariant 21 admitted only the brand mark
(as identity) and the dirty-note dot. The *read view* reverses that for one case: a `[[wikilink]]`
now renders in `--accent`, in **both** views, because the links are the structure of the vault and a
rendered note whose links are indistinguishable from its prose loses the one affordance the read
view exists to present.

## Consequences

The accent now means **the AI acted here, or this is a link into the vault**. That is a genuine
widening, and it is the reason this is on the record rather than in a spec: without it a future
reviewer reads the ember links as a violation of invariant 21 and "fixes" them. The rule stays
narrow in the ways that matter — no success state, no status indicator, no decorative fill, and
still no second colored fill beyond `--danger`.

The editor's decoration goes ember **too**, rather than diverging by view. A grey link in edit and
an ember link in read is the same link changing color under a toggle, which is worse than either
color alone. That forces the editor's `[[…]]` decoration — today a pure regex that cannot know
whether a target exists — to resolve against the cached vault tree, so a mistyped link reads as
broken while you type it.

Resolution has three outcomes, identical in both views: a target that resolves is ember and
navigable; a target that is **missing or ambiguous** is muted and struck through, never ember and
never clickable. The ambiguous case reuses ADR 0114's stance directly — two notes sharing a basename
means the link model cannot express which was meant, so the app marks it rather than guessing.

`doc/v0-spec.md` §5.6, the `acidanthera-design` skill's permitted-ember list, and `wikilink.ts`'s
own comment are all amended by this decision.

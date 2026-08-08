# The ember accent means AI agency, and nothing else

The Factory skin (#58) established a two-accent "data voice": `--accent-signal` (orange) for
live status and `--accent-metric` (green) for completed work — so a finished tool call rendered
green. The Orbit design system replaces this with a single ember accent
(`#e8683a` dark / `#f54e00` light) whose only meaning is *the AI acted here*: apply and send
buttons, the active model pill, AI glyphs, suggestion highlights. We adopt that rule, retire
`--accent-metric` entirely, and let `ToolChip`'s done state go monochrome.

The rejection is the part worth recording. Under the two-accent doctrine, green was available
for any "success" semantic, and the obvious future request — *why can't the success toast be
green?*, *why isn't the saved indicator green?* — now has a principled answer rather than a
matter of taste: color is reserved so that a user scanning the window can find every place the
agent touched without reading a word. Spending the accent on decoration destroys that signal.

Diff add/delete keep their own desaturated green and red. That is a different job — encoding
the direction of a change inside a diff — not decoration, and it is confined to diff rendering.

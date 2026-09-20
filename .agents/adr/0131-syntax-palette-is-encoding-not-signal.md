# The syntax palette is encoding, not signal

Six new `--syntax-*` hues colour lexical categories inside fenced code (#168), but they do not add a
third *meaning* to a system whose only two colours mean "the AI acted here, or this navigates into
the vault" (invariant 21) and "this click destroys" (invariant 27). `--syntax-keyword` distinguishes
a token category the way `--diff-add-fg` already distinguishes a diff direction — both are encoding,
confined to their own content, never signal about the surrounding chrome. Invariant 59 is the
boundary that keeps the addition narrow: the palette may appear only inside code content, in both
views, and never in chrome.

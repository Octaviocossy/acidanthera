# The brand mark is identity, not signal

ADR 0032 admitted the ember ring only on an icon that never renders inside the window — the app
icon and the favicon — so the ember stayed a reliable *the AI acted here* signal everywhere else.
The unified-sidebar design draws the marked hexagon inside the window, in the sidebar's brand row
and the footer identity tile, which that test cannot accommodate. We replace the test rather than
bend it: the brand mark is **identity rather than signal**, so the accent system does not apply to
it at all, and the ring renders wherever the mark renders — app icon, favicon, brand row, footer
tile, and the collapsed rail.

## Consequences

This supersedes ADR 0032 and reverses ADR 0011 decision 16, which refused the rail's mark the
accent on ADR 0007's authority. ADR 0007 itself is untouched: ember still means AI agency for
every element the accent system governs, and the mark is simply no longer one of them. The test
stays decidable because it asks what the element *is* rather than where it is drawn — which is
precisely what ADR 0032's boundary could not survive.

The cost is that one window can now show ember in three places at once: the brand row's mark, the
footer tile's mark, and the Agent row. The relocate-the-chat-toggle spec's argument for putting
`✦` in chrome was that it stayed the sole accent pixel on that surface; that argument is spent,
and the Agent row now keeps its ember on the weaker ground that it *is* the AI affordance rather
than that it is alone.

The exemption covers the mark, not a fill behind it. The footer tile is `--bg-elevated`, never
`--accent-soft` — ADR 0007's "never a large fill" still governs everything around the mark.

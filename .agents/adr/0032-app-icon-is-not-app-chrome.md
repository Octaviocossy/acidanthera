# The app icon is not app chrome

The `acidanthera` brand mark carries an ember ring at its centre, which invariant 21 admitted
for no brand mark at all — ADR 0011 decision 16 had already refused the ember to the mark on the
sidebar rail. Rather than amend ADR 0007, we draw the boundary at the window's edge: an icon
that **never renders inside the window** is not app chrome, so the app icon and the favicon keep
the ember ring, while every in-app rendering of the mark (`AcidantheraMarkGlyph`) is monochrome.

The test is "never renders inside the window", not the file's role — that is what makes the
favicon fall on the same side as the bundled icon despite being an HTML concern.

## Considered Options

Amending ADR 0007 to sanction the brand mark as a second ember surface in chrome was the
obvious alternative, and was rejected because the *chat toggle*'s ember only pays while it
stays the sole accent pixel in the titlebar — which was the entire argument for putting it
there. Stripping the ember from the icon too would have needed no exception at all, but throws
away the one place the identity has room to be itself.

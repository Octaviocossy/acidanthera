# Red marks the destructive path, not only its final click

> Status: narrows ADR 0015

ADR 0015 gave `--danger` a single meaning — "this click destroys" — and drew the line so tightly
that the sidebar context menu's Delete item was explicitly excluded, on the grounds that it opens
a confirmation dialog rather than destroying anything. Reworking that menu from three items to
seven makes the exclusion untenable: a destructive row rendered identically to the six above it is
found by reading, not by seeing, which is precisely the failure the color exists to prevent.

`Move to Trash` therefore carries `--danger` on both glyph and label. The token's meaning widens by
exactly one step — from the click that destroys to the path that leads there — and stops. A menu
row that initiates destruction and a button that commits it may carry it; nothing else may. A
failed operation still stays monochrome, and no second menu row ever becomes eligible by arguing
that it is "sort of" destructive.

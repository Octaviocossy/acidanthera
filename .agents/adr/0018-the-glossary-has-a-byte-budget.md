# The glossary has a byte budget, enforced by the gate

Each definition row's `Notes` cell is capped at **600 B** — a fixed, universal number the
scaffold ships — and each glossary file declares its own total warn/fail cap in its header,
which `verify-scaffold.sh` enforces. Exceeding the total cap fails the gate.

Prose rules against growth have already been tried and have already failed: in a downstream
project a cleanup marked **completed** both compressed the glossary *and* wrote the anti-append
rules into `domain-glossary.md`, after which the file grew roughly sixfold. A mechanical failure
is the only mechanism here that forces a retirement decision instead of letting the file grow
silently — retirement being the valve on the cap, not a ritual: a term goes when removing its row
would not change what anyone writes.

The row ceiling is fixed because it is mechanical and travels unchanged between projects; the
total cap is per-file because it depends on the size of a domain only the project knows. It is
declared in the header of the file it governs so the two cannot drift apart, and so configuring
it never means editing a file the scaffold owns.

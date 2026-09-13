# Always-on is the index and the invariants, not the glossary body

The glossary is split into a five-file family, and only two of them are `@`-imported: the
generated term → area index, and the invariants. The vocabulary bodies are read on demand.

A glossary large enough to be worth governing is too large to be held, and an agent does not
obey what it cannot recall — so keeping the whole body permanently in context buys cost without
buying authority. The index is a pointer table carrying no definitions, so it cannot disagree
with the body it points at, and it makes "does this term already exist?" cheap, which is what
actually prevents duplicate vocabulary. The invariants stay permanent because a breach of one is
a **hard violation** at the review gate and they constrain all code, not only code touching a
given term; under any other split the most enforcement-critical content becomes the least-loaded.

Dropping the import outright was the alternative and was rejected: its failure mode is silent —
nobody notices that an agent did not read a file it was never told to read.

# Deletion goes to the OS trash

Orbit's entire content is hand-written notes and the app has no undo, so deleting a vault entry
moves it to the system trash via the `trash` crate rather than calling `fs::remove_file` /
`fs::remove_dir_all`. A misclick stays recoverable from Finder, which is why there is deliberately
no in-app undo or restore-from-trash. The costs accepted are one dependency in an otherwise lean
`Cargo.toml` and a failure mode on volumes that have no trash, which surfaces as an error toast.

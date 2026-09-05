# Spec: Rust Audit Remediation

> Status: **settled**
> Created: 2026-09-05
> Grilled: 2026-09-05 — 3 rounds, 10 decisions
> Suggested next: /create-issue

## Goal

Close the gaps an Apollo-handbook audit of `src-tauri/` found: the repository has no Rust
lint or format gate at all (so `cargo fmt --check` fails on 27 hunks nobody could have seen),
the vault root is canonical on one adopt path and not the other, and the wikilink path
allocates per link, per note, on every scan and rename.

The audit's baseline was otherwise clean — `cargo clippy` passes, 136 tests pass, error
handling and test naming already follow the handbook — so this work is about the gate and a
small set of specific defects, not a refactor.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Where should the Rust lint/format gate live? | `cargo fmt --check` and `cargo clippy --all-targets --all-features --locked -- -D warnings` as steps on the existing `rust` CI job, mirrored as `lint:rust` / `format:rust` scripts | CI enforces it; the scripts let a developer run locally exactly what CI runs, the same shape the frontend already has |
| 2 | How should the Clippy configuration be expressed? | A `[lints.clippy]` table in `Cargo.toml`: `all = "deny"` plus `redundant_clone`, `large_enum_variant` and `needless_collect` named individually. No `pedantic` | `redundant_clone` moved to `nursery` and is not in `clippy::all`, so naming it is the only way to get it; rust-analyzer reads the table, so the editor matches CI |
| 3 | Should the project add a `rustfmt.toml`? | No | The handbook's two valuable keys (`group_imports`, `imports_granularity`) are nightly-only and CI pins stable — a config that reads as enforced but silently no-ops is worse than none |
| 4 | Should the stored vault root be canonical by construction? | Yes — both `open_vault` and `pick_vault` canonicalize before storing; `guarded_path` drops its root canonicalization and the three `path == root.canonicalize()?` checks become `path == root` | One boundary establishes the invariant instead of every call site re-deriving it, and it ends the same folder yielding two different strings depending on how it was opened |
| 5 | Do the wikilink loops still route through `guarded_path`? | Yes — kept, but now ~2 syscalls per file instead of 3 canonicalizations. Add `read_note_at(&Path)` / `write_note_at(&Path)` so the loops stop round-tripping `PathBuf → String → PathBuf` | Decision 4 already removed most of the cost; dropping the guard would buy the remainder at the price of an invariant that currently holds unconditionally |
| 6 | What shape should `WikilinkMatch` take? | `target: &'a str`, and drop the dead `start` / `end` fields | All three consumers are read-only comparisons and none outlives `source`; `start`/`end` are read nowhere in production, so one test assertion was dictating the API |
| 7 | How should `derive_copy_name`'s exhaustion be handled? | Name `MAX_COPY_ATTEMPTS` with a one-line *why*; the error stays `AlreadyExists` | Every `VaultError` variant is frontend surface area, and 1000 sibling copies of one file is not a state worth its own domain error |
| 8 | Is `pick_vault`'s blocking-in-async in scope? | No — out of scope, recorded below | It needs an unverified Tauri-threading fact, it is a different axis from this work, and the observable symptom today is nil |
| 9 | How do the Rust gates compose with the existing scripts and AGENTS.md? | Separate `lint:rust` / `format:rust` scripts with their own `## Commands` rows; `pnpm check` stays Biome-only | Follows the `test` / `test:rust` split already established, and the Frontend CI job runs on ubuntu-latest with no Rust toolchain, so a polyglot `pnpm check` would break it |
| 10 | Should the canonical-root decision get an ADR? | Yes — ADR 0034 | Passes all three tests in `adr.md`: hard to reverse, surprising to a reader who sees `guarded_path` trusting an unverified root, and a genuine trade-off with a user-visible consequence |

## Consequent Work (no decision required)

In scope, but nothing was decided — these follow from the findings directly:

- Run `cargo fmt`. 27 hunks across 5 files; 10 are production code, all in `settings.rs`
  (the `SettingsDiagnostic` enum, `settings_table`, `extract_string`, `parse_settings`,
  `settings::init`). The rest are test helpers whose `format!` lines the rebrand pushed past
  100 columns.
- `has_matching_stem` (`vault.rs:493`) takes the already-normalized stem instead of calling
  `stem.to_lowercase()` inside its closure, once per path in the vault.
- `build_tree_at`'s sort (`vault.rs:442`) becomes
  `sort_by_cached_key(|e| (!e.is_dir, e.name.to_lowercase()))` — n allocations instead of two
  per comparison, and dirs still sort first.
- `wikilink.rs` gains the `//!` module header every sibling module already has.

## Explicitly Out of Scope

- **`pick_vault`'s blocking-in-async.** `blocking_pick_folder()` inside an `async fn` occupies
  a runtime worker for as long as the picker is open. Its own issue — do not "fix" it here.
- **`clippy::pedantic`.** On a codebase that is already clippy-clean it would bury real
  findings under `must_use_candidate` and `missing_errors_doc` noise.
- **Any `rustfmt.toml`, and any move to `cargo +nightly fmt`.**
- **A polyglot `pnpm check`.** It would break the Frontend CI job, which has no Rust toolchain.
- **Reading trusted-source paths without `guarded_path`.** Considered and rejected in
  decision 5; invariant 4 stays enforced per call, not per walk.

## Glossary Changes

Written inline during the session (`.agents/ubiquitous-language.md`, `Last updated` → 2026-09-05):

- **Vault** — amended: the root held in `VaultState` is canonical by construction, because both
  adopt paths resolve it before storing, so no downstream caller re-canonicalizes it.
- **Invariant 4** — amended: the root is canonicalized once, at the adopt boundary;
  `guarded_path` receives an already-canonical root and canonicalizes only its target.
- Changelog row recording both, and the `pick_vault` / `open_vault` split that prompted them.

No other term changed. Decisions 5–8 alter implementation, not documented contracts.

## ADRs Raised

- `.agents/adr/0034-vault-root-is-canonical-at-the-boundary.md` — The vault root is
  canonicalized at the adopt boundary, not per call.

## Residual Unknowns

None. The frontier emptied cleanly.

One consequence is user-visible rather than unknown, and is stated here so it is not mistaken
for a regression later: after decision 4, a folder adopted through a symlink displays and
persists resolved (`/tmp/brain` → `/private/tmp/brain` on macOS), because `pick_vault` now
returns the canonical path the way `open_vault` always has.

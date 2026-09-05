//! Backend logging utility, used by every Tauri command ("use case"). Wraps `tauri-plugin-log`,
//! configuring it to append structured, timestamped, leveled lines to a local file at
//! `logs/acidanthera.log` (relative to the app's working directory — `src-tauri/` under
//! `tauri dev`) and to stdout during development. Each command logs an INFO line on entry and,
//! through the `LogResult` extension trait, an ERROR line on every failure path.

use std::{fmt::Display, path::PathBuf};

use log::LevelFilter;
use tauri::{plugin::TauriPlugin, Runtime};
use tauri_plugin_log::{Builder, Target, TargetKind};

/// The lib/crate name, used as the `level_for` target so our own logs pass at INFO while noisy
/// dependencies (tauri, notify, …) are held to WARN. Must match `[lib] name` in `Cargo.toml`.
const CRATE_TARGET: &str = "acidanthera_lib";

/// Builds the configured `tauri-plugin-log` plugin. Register it **first** in the Tauri builder
/// so it captures every subsequent plugin's logs.
///
/// - Appends to `logs/acidanthera.log` (the plugin adds the `.log` extension) and to stdout.
/// - Global level WARN; our own crate at INFO via `level_for(CRATE_TARGET, …)`.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::Folder {
            path: PathBuf::from("logs"),
            file_name: Some("acidanthera".into()),
        }))
        .target(Target::new(TargetKind::Stdout))
        .level(LevelFilter::Warn)
        .level_for(CRATE_TARGET, LevelFilter::Info)
        .build()
}

/// Extension on `Result` that logs the `Err` variant (if any) at ERROR level, prefixed with the
/// caller-supplied command name, then returns the result unchanged — so it drops straight into a
/// Tauri command's return position. `T` is unconstrained; `E` only needs `Display` (both backend
/// error enums implement it through `thiserror`).
pub trait LogResult {
    fn log_err(self, command: &str) -> Self;
}

impl<T, E: Display> LogResult for Result<T, E> {
    fn log_err(self, command: &str) -> Self {
        if let Err(err) = &self {
            log::error!("{command} failed: {err}");
        }
        self
    }
}

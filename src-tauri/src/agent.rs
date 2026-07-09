//! Generic headless-agent process spawn (doc/v0-spec.md §4.4). Spawns any `external-CLI`
//! agent by command + args + cwd, streams its stdout/stderr back to the frontend line by line,
//! and lets the frontend write turns to its stdin. Parsing a given CLI's native JSON into
//! `AgentEvent`s is that engine's own frontend adapter's job — this module never inspects the
//! lines it forwards, so it stays engine-agnostic (Claude Code today, Codex in #16).

use std::{
    env,
    ffi::OsString,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::Mutex,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

use crate::logging::LogResult;

#[derive(Debug, Error)]
pub enum AgentProcessError {
    #[error("no agent process is running")]
    NotRunning,
    #[error("`{command}` was not found. Install it and make sure it is on your PATH (also checked /opt/homebrew/bin, /usr/local/bin, ~/.local/bin, ~/.cargo/bin).")]
    CommandNotFound { command: String },
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl Serialize for AgentProcessError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type AgentProcessResult<T> = Result<T, AgentProcessError>;

struct RunningAgent {
    child: Child,
    stdin: ChildStdin,
}

/// Tracks the single running agent process, if any. Spawning a new one replaces it.
#[derive(Default)]
pub struct AgentProcessState(Mutex<Option<RunningAgent>>);

fn lock(state: &AgentProcessState) -> std::sync::MutexGuard<'_, Option<RunningAgent>> {
    state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn stop_running(state: &AgentProcessState) {
    if let Some(mut running) = lock(state).take() {
        let _ = running.child.kill();
        let _ = running.child.wait();
    }
}

/// Directories that commonly hold user-installed CLIs but are absent from the minimal PATH a
/// GUI-launched (Finder/Spotlight) macOS app inherits. `$HOME`-relative entries expand at call
/// time. Order is best-effort; the inherited PATH is always searched first (see `resolve_command`).
fn extra_path_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/opt/homebrew/sbin"),
        PathBuf::from("/usr/local/bin"),
    ];
    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        for rel in [".local/bin", ".cargo/bin", ".bun/bin", ".npm-global/bin", ".volta/bin"] {
            dirs.push(home.join(rel));
        }
    }
    dirs
}

/// True if `path` is an existing, executable regular file. `metadata` follows symlinks, so a
/// dangling symlink (e.g. a broken Homebrew cask) is correctly reported as not executable.
fn is_executable_file(path: &Path) -> bool {
    match std::fs::metadata(path) {
        Ok(md) if md.is_file() => {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                md.permissions().mode() & 0o111 != 0
            }
            #[cfg(not(unix))]
            {
                true
            }
        }
        _ => false,
    }
}

/// Resolves a bare `command` name to an absolute executable path, searching the inherited
/// PATH first, then `extra_path_dirs()`. A `command` that already contains a path separator is
/// returned unchanged (the caller/`Command` handles it). Returns `None` if nothing matches.
fn resolve_command(command: &str) -> Option<PathBuf> {
    if command.contains('/') {
        return Some(PathBuf::from(command));
    }
    let inherited: Vec<PathBuf> = env::var_os("PATH")
        .map(|p| env::split_paths(&p).collect())
        .unwrap_or_default();
    inherited
        .into_iter()
        .chain(extra_path_dirs())
        .map(|dir| dir.join(command))
        .find(|candidate| is_executable_file(candidate))
}

/// The inherited PATH with `extra_path_dirs()` appended (deduped), for the spawned child's env
/// so the engine's own sub-tools (node, git, …) also resolve under a minimal GUI PATH.
fn augmented_path() -> OsString {
    let inherited = env::var_os("PATH").unwrap_or_default();
    let mut dirs: Vec<PathBuf> = env::split_paths(&inherited).collect();
    for dir in extra_path_dirs() {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    env::join_paths(dirs).unwrap_or(inherited)
}

/// Reads `reader` line by line, emitting each non-empty line as `event`. When `emit_exit_on_close`
/// is set, emits `agent-exit` once the stream closes (process exited, whether killed or on its own).
fn spawn_line_reader<R>(app: AppHandle, reader: R, event: &'static str, emit_exit_on_close: bool)
where
    R: std::io::Read + Send + 'static,
{
    std::thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines().map_while(Result::ok) {
            if !line.is_empty() {
                let _ = app.emit(event, line);
            }
        }
        if emit_exit_on_close {
            let _ = app.emit("agent-exit", ());
        }
    });
}

/// Spawns `command` with `args` in `cwd`, replacing any process already running for this
/// session. Streams stdout as `agent-stdout` events, stderr as `agent-stderr` events, and
/// emits `agent-exit` when the process's stdout stream closes.
#[tauri::command]
pub fn agent_spawn(
    command: String,
    args: Vec<String>,
    cwd: String,
    app: AppHandle,
    state: State<'_, AgentProcessState>,
) -> AgentProcessResult<()> {
    log::info!("agent_spawn: command={command} args={args:?} cwd={cwd}");
    (|| {
        stop_running(&state);

        let resolved = resolve_command(&command)
            .ok_or_else(|| AgentProcessError::CommandNotFound { command: command.clone() })?;

        let mut child = Command::new(&resolved)
            .args(&args)
            .current_dir(&cwd)
            .env("PATH", augmented_path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| match e.kind() {
                std::io::ErrorKind::NotFound => {
                    AgentProcessError::CommandNotFound { command: command.clone() }
                }
                _ => AgentProcessError::Io(e),
            })?;

        let stdin = child.stdin.take().expect("stdin was requested as piped");
        let stdout = child.stdout.take().expect("stdout was requested as piped");
        let stderr = child.stderr.take().expect("stderr was requested as piped");

        spawn_line_reader(app.clone(), stdout, "agent-stdout", true);
        spawn_line_reader(app, stderr, "agent-stderr", false);

        *lock(&state) = Some(RunningAgent { child, stdin });
        Ok(())
    })()
    .log_err("agent_spawn")
}

/// Writes `input` (plus a trailing newline) to the running process's stdin — a user turn in
/// whatever line-delimited protocol the backend's adapter speaks.
#[tauri::command]
pub fn agent_send(input: String, state: State<'_, AgentProcessState>) -> AgentProcessResult<()> {
    log::info!("agent_send: {} bytes", input.len());
    (|| {
        let mut guard = lock(&state);
        let running = guard.as_mut().ok_or(AgentProcessError::NotRunning)?;
        writeln!(running.stdin, "{input}")?;
        running.stdin.flush()?;
        Ok(())
    })()
    .log_err("agent_send")
}

/// Terminates the running process, if any.
#[tauri::command]
pub fn agent_stop(state: State<'_, AgentProcessState>) -> AgentProcessResult<()> {
    log::info!("agent_stop");
    stop_running(&state);
    Ok(())
}

//! Generic headless-agent process spawn (doc/v0-spec.md §4.4). Spawns any `external-CLI`
//! agent by command + args + cwd, streams its stdout/stderr back to the frontend line by line,
//! and lets the frontend write turns to its stdin. Parsing a given CLI's native JSON into
//! `AgentEvent`s is that engine's own frontend adapter's job — this module never inspects the
//! lines it forwards, so it stays engine-agnostic (Claude Code today, Codex in #16).

use std::{
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::Mutex,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AgentProcessError {
    #[error("no agent process is running")]
    NotRunning,
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
    stop_running(&state);

    let mut child = Command::new(&command)
        .args(&args)
        .current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdin = child.stdin.take().expect("stdin was requested as piped");
    let stdout = child.stdout.take().expect("stdout was requested as piped");
    let stderr = child.stderr.take().expect("stderr was requested as piped");

    spawn_line_reader(app.clone(), stdout, "agent-stdout", true);
    spawn_line_reader(app, stderr, "agent-stderr", false);

    *lock(&state) = Some(RunningAgent { child, stdin });
    Ok(())
}

/// Writes `input` (plus a trailing newline) to the running process's stdin — a user turn in
/// whatever line-delimited protocol the backend's adapter speaks.
#[tauri::command]
pub fn agent_send(input: String, state: State<'_, AgentProcessState>) -> AgentProcessResult<()> {
    let mut guard = lock(&state);
    let running = guard.as_mut().ok_or(AgentProcessError::NotRunning)?;
    writeln!(running.stdin, "{input}")?;
    running.stdin.flush()?;
    Ok(())
}

/// Terminates the running process, if any.
#[tauri::command]
pub fn agent_stop(state: State<'_, AgentProcessState>) -> AgentProcessResult<()> {
    stop_running(&state);
    Ok(())
}

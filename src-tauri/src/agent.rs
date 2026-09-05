//! Generic headless-agent process spawn (doc/v0-spec.md §4.4). Spawns any `external-CLI`
//! agent by command + args + cwd, streams its stdout/stderr back to the frontend line by line,
//! and lets the frontend write turns to its stdin. Parsing a given CLI's native JSON into
//! `AgentEvent`s is that engine's own frontend adapter's job — this module never inspects the
//! lines it forwards, so it stays engine-agnostic (Claude Code today, Codex in #16).

use std::{
    env,
    ffi::{OsStr, OsString},
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
    #[error("the running agent process was spawned with its stdin closed")]
    StdinClosed,
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
    /// `None` once the caller opted out of a writable stdin (`keep_stdin_open: false`) — closed
    /// immediately after spawn so a one-shot CLI that reads until stdin EOF (e.g. Codex, which
    /// appends piped stdin to the prompt as a `<stdin>` block) doesn't hang waiting for input
    /// that will never arrive.
    stdin: Option<ChildStdin>,
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
/// GUI-launched (Finder/Spotlight) macOS app inherits. `home` supplies the `$HOME`-relative
/// entries' prefix (`None` skips them, mirroring a machine with no `$HOME` set). Order is
/// best-effort; the inherited PATH is always searched first (see `resolve_command_in`).
fn extra_path_dirs_from(home: Option<&OsStr>) -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/opt/homebrew/sbin"),
        PathBuf::from("/usr/local/bin"),
    ];
    if let Some(home) = home {
        let home = PathBuf::from(home);
        for rel in [
            ".local/bin",
            ".cargo/bin",
            ".bun/bin",
            ".npm-global/bin",
            ".volta/bin",
        ] {
            dirs.push(home.join(rel));
        }
    }
    dirs
}

fn extra_path_dirs() -> Vec<PathBuf> {
    extra_path_dirs_from(env::var_os("HOME").as_deref())
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

/// Resolves `command` against an explicit, ordered list of candidate directories, returning the
/// first existing executable match. A `command` that already contains a path separator is
/// returned unchanged (the caller/`Command` handles it) without consulting `search_dirs` at all.
fn resolve_command_in(command: &str, search_dirs: &[PathBuf]) -> Option<PathBuf> {
    if command.contains('/') {
        return Some(PathBuf::from(command));
    }
    search_dirs
        .iter()
        .map(|dir| dir.join(command))
        .find(|candidate| is_executable_file(candidate))
}

/// Resolves a bare `command` name to an absolute executable path, searching the inherited
/// PATH first, then `extra_path_dirs()`. Returns `None` if nothing matches.
fn resolve_command(command: &str) -> Option<PathBuf> {
    let inherited: Vec<PathBuf> = env::var_os("PATH")
        .map(|p| env::split_paths(&p).collect())
        .unwrap_or_default();
    let search_dirs: Vec<PathBuf> = inherited.into_iter().chain(extra_path_dirs()).collect();
    resolve_command_in(command, &search_dirs)
}

/// `inherited` (a `PATH`-style value) with `extra` appended, skipping any directory already
/// present. Falls back to `inherited` verbatim if the combined list fails to rejoin (e.g. a
/// directory containing the platform's path separator).
fn augmented_path_from(inherited: OsString, extra: Vec<PathBuf>) -> OsString {
    let mut dirs: Vec<PathBuf> = env::split_paths(&inherited).collect();
    for dir in extra {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    env::join_paths(dirs).unwrap_or(inherited)
}

/// The inherited PATH with `extra_path_dirs()` appended (deduped), for the spawned child's env
/// so the engine's own sub-tools (node, git, …) also resolve under a minimal GUI PATH.
fn augmented_path() -> OsString {
    augmented_path_from(env::var_os("PATH").unwrap_or_default(), extra_path_dirs())
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
/// emits `agent-exit` when the process's stdout stream closes. `keep_stdin_open` controls
/// whether the child's stdin stays open for later `agent_send` calls (a long-lived process
/// like Claude Code's `-p --input-format stream-json`) or is closed immediately after spawn
/// (a one-shot process like `codex exec`, which otherwise blocks reading for more input).
#[tauri::command]
pub fn agent_spawn(
    command: String,
    args: Vec<String>,
    cwd: String,
    keep_stdin_open: bool,
    app: AppHandle,
    state: State<'_, AgentProcessState>,
) -> AgentProcessResult<()> {
    log::info!(
        "agent_spawn: command={command} args={args:?} cwd={cwd} keep_stdin_open={keep_stdin_open}"
    );
    (|| {
        stop_running(&state);

        let resolved =
            resolve_command(&command).ok_or_else(|| AgentProcessError::CommandNotFound {
                command: command.clone(),
            })?;

        let mut child = Command::new(&resolved)
            .args(&args)
            .current_dir(&cwd)
            .env("PATH", augmented_path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| match e.kind() {
                std::io::ErrorKind::NotFound => AgentProcessError::CommandNotFound {
                    command: command.clone(),
                },
                _ => AgentProcessError::Io(e),
            })?;

        let stdin = child.stdin.take().expect("stdin was requested as piped");
        let stdout = child.stdout.take().expect("stdout was requested as piped");
        let stderr = child.stderr.take().expect("stderr was requested as piped");

        spawn_line_reader(app.clone(), stdout, "agent-stdout", true);
        spawn_line_reader(app, stderr, "agent-stderr", false);

        // Dropping `stdin` here closes the pipe's write end, signaling EOF to the child.
        let stdin = if keep_stdin_open { Some(stdin) } else { None };

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
        let stdin = running
            .stdin
            .as_mut()
            .ok_or(AgentProcessError::StdinClosed)?;
        writeln!(stdin, "{input}")?;
        stdin.flush()?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// A unique temp dir per test, so filesystem-based cases never collide or race.
    fn temp_dir(label: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("acidanthera-agent-{}-{label}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("creates temp dir");
        dir
    }

    /// Writes an empty file at `path`; `executable` controls the unix `+x` bits.
    fn write_fixture(path: &Path, executable: bool) {
        fs::write(path, "").expect("writes fixture");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = if executable { 0o755 } else { 0o644 };
            fs::set_permissions(path, fs::Permissions::from_mode(mode)).expect("sets permissions");
        }
    }

    #[test]
    fn is_executable_file_should_accept_only_existing_executable_regular_files() {
        let dir = temp_dir("is-executable");

        let executable = dir.join("tool");
        write_fixture(&executable, true);
        assert!(is_executable_file(&executable));

        #[cfg(unix)]
        {
            let not_executable = dir.join("data.txt");
            write_fixture(&not_executable, false);
            assert!(!is_executable_file(&not_executable));
        }

        let missing = dir.join("ghost");
        assert!(!is_executable_file(&missing));

        let subdir = dir.join("subdir");
        fs::create_dir_all(&subdir).expect("creates subdir");
        assert!(!is_executable_file(&subdir));

        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[cfg(unix)]
    #[test]
    fn is_executable_file_should_reject_a_dangling_symlink() {
        let dir = temp_dir("dangling-symlink");
        let link = dir.join("broken-cask");
        std::os::unix::fs::symlink(dir.join("does-not-exist"), &link).expect("creates symlink");

        assert!(!is_executable_file(&link));

        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn resolve_command_in_should_return_a_slashed_command_unchanged_without_searching() {
        // Even a nonexistent search list must not matter — a path-like command bypasses search.
        let resolved = resolve_command_in("./relative/tool", &[]);
        assert_eq!(resolved, Some(PathBuf::from("./relative/tool")));

        let resolved = resolve_command_in("/usr/bin/env", &[PathBuf::from("/nonexistent")]);
        assert_eq!(resolved, Some(PathBuf::from("/usr/bin/env")));
    }

    #[test]
    fn resolve_command_in_should_find_a_bare_command_in_the_search_dirs() {
        let dir = temp_dir("resolve-found");
        let tool = dir.join("acidanthera-tool");
        write_fixture(&tool, true);

        let resolved = resolve_command_in("acidanthera-tool", std::slice::from_ref(&dir));

        assert_eq!(resolved, Some(tool));

        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn resolve_command_in_should_search_dirs_in_order_and_use_the_first_match() {
        let first = temp_dir("resolve-order-first");
        let second = temp_dir("resolve-order-second");
        write_fixture(&first.join("acidanthera-tool"), true);
        write_fixture(&second.join("acidanthera-tool"), true);

        let resolved = resolve_command_in("acidanthera-tool", &[first.clone(), second.clone()]);

        assert_eq!(resolved, Some(first.join("acidanthera-tool")));

        fs::remove_dir_all(&first).expect("cleans up");
        fs::remove_dir_all(&second).expect("cleans up");
    }

    #[cfg(unix)]
    #[test]
    fn resolve_command_in_should_skip_a_non_executable_match_and_keep_searching() {
        let first = temp_dir("resolve-skip-non-exec-first");
        let second = temp_dir("resolve-skip-non-exec-second");
        write_fixture(&first.join("acidanthera-tool"), false);
        write_fixture(&second.join("acidanthera-tool"), true);

        let resolved = resolve_command_in("acidanthera-tool", &[first.clone(), second.clone()]);

        assert_eq!(resolved, Some(second.join("acidanthera-tool")));

        fs::remove_dir_all(&first).expect("cleans up");
        fs::remove_dir_all(&second).expect("cleans up");
    }

    #[test]
    fn resolve_command_in_should_return_none_when_no_search_dir_has_the_command() {
        let dir = temp_dir("resolve-missing");

        let resolved = resolve_command_in(
            "acidanthera-tool-that-does-not-exist",
            std::slice::from_ref(&dir),
        );

        assert_eq!(resolved, None);

        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn extra_path_dirs_from_should_always_include_the_fixed_macos_dirs() {
        let dirs = extra_path_dirs_from(None);

        assert!(dirs.contains(&PathBuf::from("/opt/homebrew/bin")));
        assert!(dirs.contains(&PathBuf::from("/opt/homebrew/sbin")));
        assert!(dirs.contains(&PathBuf::from("/usr/local/bin")));
    }

    #[test]
    fn extra_path_dirs_from_should_skip_home_relative_dirs_when_home_is_none() {
        let dirs = extra_path_dirs_from(None);

        assert!(!dirs.iter().any(|d| d.ends_with(".cargo/bin")));
        assert!(!dirs.iter().any(|d| d.ends_with(".local/bin")));
    }

    #[test]
    fn extra_path_dirs_from_should_expand_home_relative_dirs_when_home_is_given() {
        let home = OsString::from("/Users/tester");
        let dirs = extra_path_dirs_from(Some(&home));

        for rel in [
            ".local/bin",
            ".cargo/bin",
            ".bun/bin",
            ".npm-global/bin",
            ".volta/bin",
        ] {
            assert!(
                dirs.contains(&PathBuf::from("/Users/tester").join(rel)),
                "missing {rel}"
            );
        }
    }

    #[test]
    fn augmented_path_from_should_append_extra_dirs_not_already_present() {
        let inherited = OsString::from("/usr/bin:/bin");
        let extra = vec![
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
        ];

        let augmented = augmented_path_from(inherited, extra);
        let dirs: Vec<PathBuf> = env::split_paths(&augmented).collect();

        assert_eq!(
            dirs,
            vec![
                PathBuf::from("/usr/bin"),
                PathBuf::from("/bin"),
                PathBuf::from("/opt/homebrew/bin"),
                PathBuf::from("/usr/local/bin"),
            ]
        );
    }

    #[test]
    fn augmented_path_from_should_not_duplicate_a_dir_already_on_the_inherited_path() {
        let inherited = OsString::from("/usr/bin:/opt/homebrew/bin");
        let extra = vec![
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
        ];

        let augmented = augmented_path_from(inherited, extra);
        let dirs: Vec<PathBuf> = env::split_paths(&augmented).collect();

        assert_eq!(
            dirs,
            vec![
                PathBuf::from("/usr/bin"),
                PathBuf::from("/opt/homebrew/bin"),
                PathBuf::from("/usr/local/bin"),
            ]
        );
    }

    #[test]
    fn augmented_path_from_should_handle_an_empty_inherited_path() {
        let augmented =
            augmented_path_from(OsString::new(), vec![PathBuf::from("/opt/homebrew/bin")]);

        // `env::split_paths("")` yields one empty component (matches the platform's own
        // parsing of an empty `PATH`), so the extra dir is appended after it, not instead of it.
        let dirs: Vec<PathBuf> = env::split_paths(&augmented).collect();
        assert_eq!(
            dirs,
            vec![PathBuf::from(""), PathBuf::from("/opt/homebrew/bin")]
        );
    }

    #[test]
    fn command_not_found_error_should_report_the_missing_command_and_search_locations() {
        let error = AgentProcessError::CommandNotFound {
            command: "ghost-cli".into(),
        };

        let message = error.to_string();
        assert!(message.contains("ghost-cli"));
        assert!(message.contains("PATH"));
    }

    #[test]
    fn agent_process_error_should_serialize_as_a_plain_string() {
        let error = AgentProcessError::StdinClosed;

        let json = serde_json::to_string(&error).expect("serializes");

        assert_eq!(
            json,
            "\"the running agent process was spawned with its stdin closed\""
        );
    }
}

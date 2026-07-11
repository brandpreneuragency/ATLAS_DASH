use std::path::PathBuf;

use base64::Engine;
use tauri::{AppHandle, State};

use crate::terminal::TerminalRegistry;

#[derive(serde::Serialize, Clone)]
pub struct TerminalSummary {
    pub id: String,
}

/// Spawn a new PTY-backed terminal session.
#[tauri::command]
pub fn terminal_create(
    app: AppHandle,
    registry: State<'_, TerminalRegistry>,
    id: String,
    cwd: Option<String>,
    shell: Option<String>,
) -> Result<(), String> {
    if registry.contains(&id) {
        return Err(format!("terminal '{id}' already exists"));
    }
    let cwd = cwd.filter(|c| !c.trim().is_empty());
    let session = PtySessionSpawn::spawn(app, id.clone(), cwd, shell)?;
    if registry.insert(id.clone(), session) {
        Ok(())
    } else {
        Err(format!("terminal '{id}' already exists"))
    }
}

/// Write input (base64-encoded UTF-8) to a terminal's PTY stdin.
#[tauri::command]
pub fn terminal_write(
    registry: State<'_, TerminalRegistry>,
    id: String,
    data: String,
) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("invalid base64: {e}"))?;
    registry.write(&id, &bytes)
}

/// Resize a terminal's PTY.
#[tauri::command]
pub fn terminal_resize(
    registry: State<'_, TerminalRegistry>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    registry.resize(&id, cols, rows)
}

/// Kill a terminal session and free its resources.
#[tauri::command]
pub fn terminal_kill(registry: State<'_, TerminalRegistry>, id: String) -> Result<(), String> {
    if registry.remove(&id) {
        Ok(())
    } else {
        Err(format!("no such terminal: {id}"))
    }
}

/// List active terminal ids (for state hydration).
#[tauri::command]
pub fn terminal_list(registry: State<'_, TerminalRegistry>) -> Vec<TerminalSummary> {
    registry
        .ids()
        .into_iter()
        .map(|id| TerminalSummary { id })
        .collect()
}

/// Return the user's home directory (default terminal cwd).
#[tauri::command]
pub fn home_dir() -> Result<String, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "could not resolve home directory".to_string())?;
    Ok(PathBuf::from(home).to_string_lossy().to_string())
}

// Re-export the spawn helper from the session module under a clearer name.
use crate::terminal::session::PtySession as PtySessionSpawn;

use std::collections::HashMap;
use std::sync::Mutex;

use crate::terminal::session::PtySession;

/// Thread-safe registry of active PTY sessions, keyed by terminal id.
pub struct TerminalRegistry {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl TerminalRegistry {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Insert a new session. Returns false if the id already exists.
    pub fn insert(&self, id: String, session: PtySession) -> bool {
        let mut guard = self.sessions.lock().unwrap();
        if guard.contains_key(&id) {
            return false;
        }
        guard.insert(id, session);
        true
    }

    /// Write raw bytes to a session's PTY stdin.
    pub fn write(&self, id: &str, data: &[u8]) -> Result<(), String> {
        let mut guard = self.sessions.lock().unwrap();
        let session = guard
            .get_mut(id)
            .ok_or_else(|| format!("no such terminal: {id}"))?;
        session.write(data)
    }

    /// Resize a session's PTY.
    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let guard = self.sessions.lock().unwrap();
        let session = guard
            .get(id)
            .ok_or_else(|| format!("no such terminal: {id}"))?;
        session.resize(cols, rows)
    }

    /// Remove a session, dropping it (kills child + joins reader thread).
    pub fn remove(&self, id: &str) -> bool {
        let mut guard = self.sessions.lock().unwrap();
        guard.remove(id).is_some()
    }

    /// Whether a session with the given id exists.
    pub fn contains(&self, id: &str) -> bool {
        self.sessions.lock().unwrap().contains_key(id)
    }

    /// List all active terminal ids.
    pub fn ids(&self) -> Vec<String> {
        self.sessions.lock().unwrap().keys().cloned().collect()
    }
}

impl Default for TerminalRegistry {
    fn default() -> Self {
        Self::new()
    }
}

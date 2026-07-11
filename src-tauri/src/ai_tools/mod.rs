//! AI tool surface (Claude Code-parity) exposed to the AI sidebar.
//!
//! All commands are workspace-root sandboxed via [`sandbox::resolve_in_workspace`],
//! which is enforced in Rust (not the frontend) so a compromised frontend cannot
//! escape the workspace.

pub mod fs_ops;
pub mod sandbox;
pub mod search;
pub mod shell;

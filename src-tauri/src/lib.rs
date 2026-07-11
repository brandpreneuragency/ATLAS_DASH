// TABS desktop shell.
//
// Phase 2 native features:
//   * Single-instance: a second launch focuses the existing window.
//   * Notification: tauri-plugin-notification (test command below).
//   * Global shortcut Ctrl+Shift+Space: focuses the main window from any app.
//   * Tray icon: Show TABS / Quit menu.
//   * File association: argv is scanned for a *.tabs file path; if present, a
//     `tabs://open-file` event is emitted to the frontend with the path.
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub mod ai_tools;
mod commands;
mod terminal;
mod tray;

// Convenience command to exercise the notification plugin from the webview
// devtools console:
//   await window.__TAURI__.core.invoke('test_notification')
#[tauri::command]
fn test_notification(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title("TABS")
        .body("Phase 2 notification test")
        .show()
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Single-instance MUST be the first plugin. When a second copy is
        // launched, it exits immediately and our callback focuses the
        // already-running window.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(terminal::TerminalRegistry::new())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed
                        && shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::Space)
                    {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            test_notification,
            commands::secrets::secret_get,
            commands::secrets::secret_set,
            commands::secrets::secret_delete,
            commands::search::search_web,
            commands::terminal::terminal_create,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
            commands::terminal::terminal_list,
            commands::terminal::home_dir,
            commands::ai_tools::shell::ai_shell_exec,
            commands::ai_tools::fs_ops::ai_file_read,
            commands::ai_tools::fs_ops::ai_file_write,
            commands::ai_tools::fs_ops::ai_file_edit,
            commands::ai_tools::search::ai_glob,
            commands::ai_tools::search::ai_grep
        ])
        .setup(|app| {
            // Intercept the main window's close button: instead of quitting
            // the app, hide the window so the tray icon remains usable.
            // The user can quit from the tray's "Quit" menu item, or by
            // pressing Ctrl+Shift+Space (which will refocus the hidden
            // window if it's still running).
            if let Some(window) = app.get_webview_window("main") {
                let window_for_close = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_for_close.hide();
                    }
                });
            }

            // The main window is now created with `visible: true` in
            // tauri.conf.json so it shows up reliably on first launch.
            // We still call `show()` + `set_focus()` here as a belt-and-
            // braces guarantee: this runs after WebView2 is initialized
            // and the window is fully ready, so the show will actually
            // take effect (the old `visible: false` + immediate show()
            // had a race that left the window invisible on some machines).
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            // Register Ctrl+Shift+Space as the "focus TABS" global hotkey.
            let shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::Space,
            );
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("[TABS] Failed to register Ctrl+Shift+Space: {e}");
            }

            // Build the tray icon.
            tray::build(app.handle())?;

            // If we were launched with a .tabs file on the command line, emit
            // it to the frontend so the document can be opened. (Installed
            // builds receive the path from the OS file association; dev builds
            // can be tested by passing a path on the command line.)
            for arg in std::env::args().skip(1) {
                let p = std::path::Path::new(&arg);
                if p.extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.eq_ignore_ascii_case("tabs"))
                    .unwrap_or(false)
                    && p.exists()
                {
                    let _ = app.handle().emit("tabs://open-file", arg);
                    break;
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

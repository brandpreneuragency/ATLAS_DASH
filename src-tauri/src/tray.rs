// Tray icon: right-click menu with "Show TABS", "Test Notification", and
// "Quit". Left-click focuses the main window. Uses the default window icon
// (configured in tauri.conf.json).
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_notification::NotificationExt;

pub fn build(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show TABS", true, None::<&str>)?;
    let test =
        MenuItem::with_id(app, "test_notification", "Test Notification", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &test, &quit])?;

    // Convert the borrowed Image<'_> into an owned Image<'static> so the
    // builder can outlive the AppHandle borrow returned by default_window_icon().
    let icon: Image<'static> = app
        .default_window_icon()
        .map(|img| img.clone().to_owned())
        .expect("default window icon not configured in tauri.conf.json bundle.icon");

    TrayIconBuilder::with_id("tabs-tray")
        .icon(icon)
        .tooltip("TABS")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "test_notification" => {
                // Same payload as the `test_notification` Tauri command in
                // lib.rs, but reachable from the tray without needing the
                // webview devtools (which clashes with Chrome's F12).
                if let Err(e) = app
                    .notification()
                    .builder()
                    .title("TABS")
                    .body("Phase 2 notification test")
                    .show()
                {
                    eprintln!("[TABS] notification failed: {e}");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(w) = tray.app_handle().get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

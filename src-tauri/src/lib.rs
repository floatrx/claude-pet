mod state;

use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use state::{read_state, state_file_path};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::utils::config::Color;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // -- Window setup --
            let window = app.get_webview_window("main").expect("main window not found");

            // Position at screen bottom
            if let Some(monitor) = window.current_monitor()? {
                let screen = monitor.size();
                let scale = monitor.scale_factor();
                let win_height = 200.0 * scale;
                let x = 0.0;
                let y = (screen.height as f64) - win_height;
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: x as i32,
                    y: y as i32,
                }))?;
                window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: screen.width,
                    height: (win_height) as u32,
                }))?;
            }

            // Transparent background (required for macOS WKWebView)
            window.set_background_color(Some(Color(0, 0, 0, 0)))?;

            // Click-through by default
            window.set_ignore_cursor_events(true)?;

            // -- System Tray --
            let click_through = CheckMenuItemBuilder::new("Click-through")
                .checked(true)
                .id("click_through")
                .build(app)?;
            let visible = CheckMenuItemBuilder::new("Visible")
                .checked(true)
                .id("visible")
                .build(app)?;
            let quit = MenuItemBuilder::new("Quit").id("quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&click_through)
                .item(&visible)
                .separator()
                .item(&quit)
                .build()?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Claude Pet")
                .on_menu_event(move |app, event| {
                    let win = app.get_webview_window("main").unwrap();
                    match event.id().as_ref() {
                        "click_through" => {
                            let checked = click_through.is_checked().unwrap_or(false);
                            let _ = win.set_ignore_cursor_events(checked);
                        }
                        "visible" => {
                            let is_visible = visible.is_checked().unwrap_or(true);
                            if is_visible {
                                let _ = win.show();
                            } else {
                                let _ = win.hide();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // -- File Watcher --
            let app_handle = app.handle().clone();
            let state_path = state_file_path();
            let watch_dir = state_path.parent().unwrap().to_path_buf();

            thread::spawn(move || {
                let (tx, rx) = mpsc::channel();

                // Watcher must stay alive for the duration of the thread (dropped only on app exit)
                let mut watcher = recommended_watcher(move |res: Result<Event, _>| {
                    if let Ok(event) = res {
                        if matches!(
                            event.kind,
                            EventKind::Create(_) | EventKind::Modify(_)
                        ) {
                            let is_pet_state = event.paths.iter().any(|p| {
                                p.file_name()
                                    .map(|n| n == "pet-state.json")
                                    .unwrap_or(false)
                            });
                            if is_pet_state {
                                let _ = tx.send(());
                            }
                        }
                    }
                })
                .expect("Failed to create file watcher");

                watcher
                    .watch(&watch_dir, RecursiveMode::NonRecursive)
                    .expect("Failed to watch directory");

                // Also emit initial state if file exists
                if let Some(state) = read_state(&state_path) {
                    let _ = app_handle.emit("pet-state-changed", state);
                }

                loop {
                    if rx.recv_timeout(Duration::from_millis(100)).is_ok() {
                        // Debounce: drain any queued events
                        while rx.try_recv().is_ok() {}
                        // Small delay for atomic writes to complete
                        thread::sleep(Duration::from_millis(50));

                        if let Some(state) = read_state(&state_path) {
                            let _ = app_handle.emit("pet-state-changed", state);
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

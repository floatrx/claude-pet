mod state;

use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use state::{read_state, state_file_path};
use std::process::Command;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::utils::config::Color;
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
struct DockInfo {
    height: f64,
}

/// Get dock height in logical pixels using Swift/AppKit
fn get_dock_height() -> f64 {
    let output = Command::new("swift")
        .arg("-e")
        .arg("import AppKit; print(NSScreen.main!.visibleFrame.origin.y)")
        .output();

    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout)
            .trim()
            .parse::<f64>()
            .unwrap_or(70.0),
        Err(_) => 70.0, // fallback
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window not found");

            // Detect dock height
            let dock_height = get_dock_height();

            // Full-screen transparent window (pets default to dock area, can be dragged anywhere)
            if let Some(monitor) = window.current_monitor()? {
                let screen = monitor.size();
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: 0,
                    y: 0,
                }))?;
                window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: screen.width,
                    height: screen.height,
                }))?;
            }

            // Transparent background (required for macOS WKWebView)
            window.set_background_color(Some(Color(0, 0, 0, 0)))?;

            // Click-through by default
            window.set_ignore_cursor_events(true)?;

            // Emit dock info to frontend so it knows where to draw pets
            app.emit("dock-info", DockInfo { height: dock_height })?;

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

            TrayIconBuilder::with_id("claude-pet-tray")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?)
                .icon_as_template(true)
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
                .build(app)
                .expect("Failed to build tray icon");

            // Hide from dock AFTER tray is set up
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

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

                // Emit initial state if file exists
                if let Some(state) = read_state(&state_path) {
                    let _ = app_handle.emit("pet-state-changed", state);
                }

                loop {
                    if rx.recv_timeout(Duration::from_millis(100)).is_ok() {
                        while rx.try_recv().is_ok() {}
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

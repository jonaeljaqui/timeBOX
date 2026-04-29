use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

mod timer;

use timer::{ActiveTimerState, TimerSnapshot};

#[tauri::command(rename_all = "snake_case")]
fn timer_start(
    app: AppHandle,
    state: tauri::State<'_, Mutex<ActiveTimerState>>,
    timebox_id: i64,
    title: String,
    category: Option<String>,
    planned_minutes: i64,
) -> Result<TimerSnapshot, String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    let snap = s.start(timebox_id, title, category, planned_minutes);
    let _ = app.emit("timer:tick", &snap);
    timer::spawn_ticker(app.clone());
    Ok(snap)
}

#[tauri::command]
fn timer_stop(
    app: AppHandle,
    state: tauri::State<'_, Mutex<ActiveTimerState>>,
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.stop();
    let _ = app.emit("timer:stopped", ());
    Ok(())
}

#[tauri::command]
fn timer_get(
    state: tauri::State<'_, Mutex<ActiveTimerState>>,
) -> Result<Option<TimerSnapshot>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(s.snapshot())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial timebox schema",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add MIT + deliverable + structured review",
            sql: include_str!("../migrations/002_v2.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:timebox.db", migrations)
                .build(),
        )
        .manage(Mutex::new(ActiveTimerState::default()))
        .invoke_handler(tauri::generate_handler![
            timer_start,
            timer_stop,
            timer_get,
        ])
        .setup(|app| {
            timer::init_tray(app)?;
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

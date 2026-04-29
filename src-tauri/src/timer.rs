use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Emitter, Manager,
};

/// Snapshot of the running timer, suitable for emitting to JS or rendering on the tray.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimerSnapshot {
    pub timebox_id: i64,
    pub title: String,
    pub category: Option<String>,
    pub planned_minutes: i64,
    pub started_at_ms: i64,    // wall-clock millis since epoch (for JS display)
    pub elapsed_secs: i64,
    pub remaining_secs: i64,   // negative if overrun
    pub overrun: bool,
}

#[derive(Default)]
pub struct ActiveTimerState {
    timebox_id: Option<i64>,
    title: String,
    category: Option<String>,
    planned_minutes: i64,
    started_instant: Option<Instant>,
    started_wall_ms: i64,
}

impl ActiveTimerState {
    pub fn start(
        &mut self,
        timebox_id: i64,
        title: String,
        category: Option<String>,
        planned_minutes: i64,
    ) -> TimerSnapshot {
        let now = Instant::now();
        let wall_ms = chrono::Utc::now().timestamp_millis();
        self.timebox_id = Some(timebox_id);
        self.title = title;
        self.category = category;
        self.planned_minutes = planned_minutes;
        self.started_instant = Some(now);
        self.started_wall_ms = wall_ms;
        self.snapshot().expect("just started")
    }

    pub fn stop(&mut self) {
        self.timebox_id = None;
        self.title.clear();
        self.category = None;
        self.planned_minutes = 0;
        self.started_instant = None;
        self.started_wall_ms = 0;
    }

    pub fn is_running(&self) -> bool {
        self.timebox_id.is_some() && self.started_instant.is_some()
    }

    pub fn snapshot(&self) -> Option<TimerSnapshot> {
        let id = self.timebox_id?;
        let started = self.started_instant?;
        let elapsed = started.elapsed().as_secs() as i64;
        let total = self.planned_minutes * 60;
        let remaining = total - elapsed;
        Some(TimerSnapshot {
            timebox_id: id,
            title: self.title.clone(),
            category: self.category.clone(),
            planned_minutes: self.planned_minutes,
            started_at_ms: self.started_wall_ms,
            elapsed_secs: elapsed,
            remaining_secs: remaining,
            overrun: remaining < 0,
        })
    }
}

/// Spawn a background ticker that emits `timer:tick` once per second while a box is active.
/// Idempotent — only one ticker runs at a time per process.
static TICKER_RUNNING: OnceLock<()> = OnceLock::new();

pub fn spawn_ticker(app: AppHandle) {
    if TICKER_RUNNING.set(()).is_err() {
        return;
    }
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(1));
        let snap = {
            let state = match app.try_state::<Mutex<ActiveTimerState>>() {
                Some(s) => s,
                None => continue,
            };
            let guard = match state.lock() {
                Ok(g) => g,
                Err(_) => continue,
            };
            if !guard.is_running() {
                continue;
            }
            guard.snapshot()
        };

        if let Some(snap) = snap {
            let _ = app.emit("timer:tick", &snap);
            update_tray_title(&app, Some(&snap));

            if snap.remaining_secs == 0 {
                let _ = app.emit("timer:complete", &snap);
            }
        } else {
            update_tray_title(&app, None);
        }
    });
}

const TRAY_ID: &str = "timebox-tray";

pub fn init_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "打开 时间盒", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "停止当前时间盒", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &stop, &quit])?;

    let _tray: TrayIcon = TrayIconBuilder::with_id(TRAY_ID)
        .icon(default_tray_icon())
        .icon_as_template(true)
        .title("时间盒")
        .tooltip("时间盒")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                }
            }
            "stop" => {
                if let Some(state) = app.try_state::<Mutex<ActiveTimerState>>() {
                    if let Ok(mut s) = state.lock() {
                        s.stop();
                    }
                }
                let _ = app.emit("timer:stopped", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn update_tray_title(app: &AppHandle, snap: Option<&TimerSnapshot>) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let title = match snap {
            Some(s) => format_tray_text(s),
            None => "时间盒".to_string(),
        };
        let _ = tray.set_title(Some(title));
    }
}

fn format_tray_text(snap: &TimerSnapshot) -> String {
    let secs = snap.remaining_secs.abs();
    let mm = secs / 60;
    let ss = secs % 60;
    let prefix = if snap.overrun { "+" } else { "" };
    let cat = snap.category.as_deref().unwrap_or("");
    let label = if cat.is_empty() {
        snap.title.clone()
    } else {
        format!("{} · {}", cat, snap.title)
    };
    let truncated = truncate_label(&label, 24);
    format!("{} {}{:02}:{:02}", truncated, prefix, mm, ss)
}

fn truncate_label(s: &str, max_chars: usize) -> String {
    let mut out = String::new();
    let mut count = 0;
    for ch in s.chars() {
        if count >= max_chars {
            out.push('…');
            break;
        }
        out.push(ch);
        count += 1;
    }
    out
}

/// 16×16 template icon — a hollow rounded square, drawn at runtime as RGBA bytes.
/// With `icon_as_template(true)`, macOS recolors black pixels to match the menu bar.
fn default_tray_icon() -> Image<'static> {
    const W: usize = 16;
    const H: usize = 16;
    static RGBA: std::sync::OnceLock<Vec<u8>> = std::sync::OnceLock::new();
    let bytes = RGBA.get_or_init(|| {
        let mut buf = vec![0u8; W * H * 4];
        for y in 0..H {
            for x in 0..W {
                let on_edge =
                    (x == 1 || x == W - 2 || y == 1 || y == H - 2)
                        && x >= 1
                        && x <= W - 2
                        && y >= 1
                        && y <= H - 2;
                let corner =
                    (x == 1 && y == 1) || (x == W - 2 && y == 1)
                        || (x == 1 && y == H - 2) || (x == W - 2 && y == H - 2);
                if on_edge && !corner {
                    let i = (y * W + x) * 4;
                    buf[i] = 0;       // R
                    buf[i + 1] = 0;   // G
                    buf[i + 2] = 0;   // B
                    buf[i + 3] = 255; // A — black; template mode recolors it
                }
            }
        }
        buf
    });
    Image::new(bytes, W as u32, H as u32)
}

mod commands;

use commands::*;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Dev/release: force a high-res window/taskbar icon (Windows often
            // falls back to a tiny embedded default otherwise).
            if let Some(window) = app.get_webview_window("main") {
                let icon =
                    tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
                        .map_err(|e| format!("load app icon: {e}"))?;
                window
                    .set_icon(icon)
                    .map_err(|e| format!("set app icon: {e}"))?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_apps,
            get_app_manifest,
            refresh_manifests,
            clear_manifest_cache,
            download_app,
            launch_app,
            detect_install,
            get_app_details,
            uninstall_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

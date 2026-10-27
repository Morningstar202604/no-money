use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // 创建托盘菜单
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            // 托盘图标：缺省图标缺失时不 panic（icon 接受 Option），仅无图标显示
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().cloned())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // 设置窗口标题
            if let Some(window) = app.get_webview_window("main") {
                window.set_title("没钱 No Money").ok();
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 关闭窗口时最小化到托盘而不是退出
                window.hide().ok();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_rules_data,
            save_rules_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// city → 规则文件路径。fail-closed：city 只允许纯小写 ASCII 字母，
/// 使 `../`、`\`、空串、编码绕过不可表达；归一化后仍复核前缀作纵深防御。
fn rules_path(city: &str) -> Result<std::path::PathBuf, String> {
    if city.is_empty() || !city.chars().all(|c| c.is_ascii_lowercase()) {
        return Err(format!("非法城市标识: {}", city));
    }
    let path = std::path::PathBuf::from("../public/rules").join(format!("{}.json", city));
    let normalized: std::path::PathBuf = path.components().collect();
    if !normalized.starts_with("../public/rules") {
        return Err("路径越界".to_string());
    }
    Ok(normalized)
}

#[tauri::command]
async fn get_rules_data(city: String) -> Result<serde_json::Value, String> {
    let path = rules_path(&city)?;
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取规则文件失败: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;
    Ok(json)
}

#[tauri::command]
async fn save_rules_data(city: String, data: serde_json::Value) -> Result<(), String> {
    let path = rules_path(&city)?;
    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("序列化 JSON 失败: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("写入规则文件失败: {}", e))?;
    Ok(())
}
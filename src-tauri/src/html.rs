use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetPayload {
    /// Относительный путь внутри папки экспорта, например "assets/images/photo.png"
    pub relative_path: String,
    /// Содержимое файла в base64
    pub data_base64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePresentationArgs {
    /// Корневая папка экспорта, выбранная пользователем
    pub root_dir: String,
    /// Имя проекта — используется как имя подпапки и HTML-файла
    pub project_name: String,
    /// Готовый HTML
    pub html: String,
    /// Внешние ассеты (изображения, аудио, видео, .glb, .gltf)
    pub assets: Vec<AssetPayload>,
    /// true → index.html (для запуска через сервер), false → <projectName>.html
    pub index_html: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub output_dir: String,
    pub html_path: String,
    pub asset_count: usize,
}

/// Санитизация имени проекта: убираем слэши, двоеточия и т.п.
fn sanitize_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.');
    if trimmed.is_empty() {
        "presentation".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Защита от path traversal: итоговый путь не должен выходить за output_dir.
fn safe_join(base: &Path, relative: &str) -> Result<PathBuf, String> {
    let candidate = base.join(relative);
    // нормализуем без обращения к ФС
    let normalized: PathBuf = candidate
        .components()
        .fold(PathBuf::new(), |mut acc, comp| {
            use std::path::Component::*;
            match comp {
                ParentDir => {
                    acc.pop();
                }
                CurDir => {}
                other => acc.push(other.as_os_str()),
            }
            acc
        });

    if !normalized.starts_with(base) {
        return Err(format!(
            "Недопустимый путь ассета (выход за пределы папки): {}",
            relative
        ));
    }
    Ok(normalized)
}

#[command]
pub async fn save_presentation(args: SavePresentationArgs) -> Result<SaveResult, String> {
    let root = PathBuf::from(&args.root_dir);
    if !root.exists() {
        return Err(format!("Папка экспорта не существует: {}", args.root_dir));
    }
    if !root.is_dir() {
        return Err(format!(
            "Указанный путь не является папкой: {}",
            args.root_dir
        ));
    }

    let project = sanitize_name(&args.project_name);
    let output_dir = root.join(&project);

    // Удаляем старую папку экспорта целиком (если существует),
    // чтобы избавиться от устаревших ассетов.
    if output_dir.exists() {
        fs::remove_dir_all(&output_dir)
            .map_err(|e| format!("Не удалось очистить папку {}: {}", output_dir.display(), e))?;
    }

    // Создаём заново
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Не удалось создать папку {}: {}", output_dir.display(), e))?;

    // Записываем ассеты
    let mut asset_count = 0usize;
    for asset in &args.assets {
        let target = safe_join(&output_dir, &asset.relative_path)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Не удалось создать {}: {}", parent.display(), e))?;
        }
        let bytes = STANDARD
            .decode(&asset.data_base64)
            .map_err(|e| format!("Некорректный base64 для {}: {}", asset.relative_path, e))?;
        fs::write(&target, bytes)
            .map_err(|e| format!("Не удалось записать {}: {}", target.display(), e))?;
        asset_count += 1;
    }

    // Записываем HTML
    let html_name = if args.index_html {
        "index.html".to_string()
    } else {
        format!("{}.html", project)
    };
    let html_path = output_dir.join(&html_name);

    fs::write(&html_path, args.html.as_bytes())
        .map_err(|e| format!("Не удалось записать {}: {}", html_path.display(), e))?;

    Ok(SaveResult {
        output_dir: output_dir.to_string_lossy().to_string(),
        html_path: html_path.to_string_lossy().to_string(),
        asset_count,
    })
}

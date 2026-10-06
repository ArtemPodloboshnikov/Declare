use base64::{engine::general_purpose::STANDARD, Engine};
use font_kit::family_name::FamilyName;
use font_kit::handle::Handle;
use font_kit::properties::{Properties, Stretch, Style, Weight};
use font_kit::source::SystemSource;
use serde::Serialize;
use std::collections::BTreeSet;
use std::ffi::OsStr;
use std::path::PathBuf;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FontFamily {
    pub name: String,
    pub styles: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontFileData {
    pub family: String,
    pub style: String,
    pub mime: String,
    pub data_base64: String,
    pub file_name: String,
}

#[tauri::command]
pub fn list_system_fonts() -> Result<Vec<FontFamily>, String> {
    let source = SystemSource::new();

    let families = source
        .all_families()
        .map_err(|e| format!("Не удалось получить список шрифтов: {}", e))?;

    let mut set: BTreeSet<String> = BTreeSet::new();
    for f in families {
        let trimmed = f.trim();
        if trimmed.is_empty() || trimmed.starts_with('.') {
            continue;
        }
        set.insert(trimmed.to_string());
    }

    let mut result: Vec<FontFamily> = Vec::with_capacity(set.len());
    for name in set {
        let mut styles: Vec<String> = Vec::new();

        if let Ok(family) = source.select_family_by_name(&name) {
            for handle in family.fonts() {
                if let Ok(font) = handle.load() {
                    let props = font.properties();
                    let s = describe_style(&props);
                    if !styles.contains(&s) {
                        styles.push(s);
                    }
                }
            }
        }

        if styles.is_empty() {
            styles.push("Regular".to_string());
        }
        result.push(FontFamily { name, styles });
    }

    Ok(result)
}

fn describe_style(props: &Properties) -> String {
    let weight = match props.weight {
        Weight::THIN => "Thin",
        Weight::EXTRA_LIGHT => "ExtraLight",
        Weight::LIGHT => "Light",
        Weight::NORMAL => "Regular",
        Weight::MEDIUM => "Medium",
        Weight::SEMIBOLD => "SemiBold",
        Weight::BOLD => "Bold",
        Weight::EXTRA_BOLD => "ExtraBold",
        Weight::BLACK => "Black",
        _ => "Regular",
    };

    let style = match props.style {
        Style::Normal => "",
        Style::Italic => " Italic",
        Style::Oblique => " Oblique",
    };

    format!("{}{}", weight, style)
}

#[tauri::command]
pub fn read_font_file(family: String, style: String) -> Result<FontFileData, String> {
    let source = SystemSource::new();
    let (weight, style_k) = parse_style(&style);

    let props = Properties {
        weight,
        style: style_k,
        stretch: Stretch::NORMAL,
    };

    let handle = source
        .select_best_match(&[FamilyName::Title(family.clone())], &props)
        .map_err(|e| format!("Шрифт {} ({}) не найден: {}", family, style, e))?;

    // Handle — это enum: Path или Memory
    let path: PathBuf = match handle {
        Handle::Path { path, .. } => path,
        Handle::Memory { .. } => {
            return Err("Шрифт загружен в память, путь к файлу недоступен".to_string());
        }
    };

    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Не удалось прочитать {}: {}", path.display(), e))?;

    let ext = path
        .extension()
        .and_then(|s: &OsStr| s.to_str())
        .unwrap_or("ttf")
        .to_lowercase();

    let mime = match ext.as_str() {
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttc" => "font/collection",
        _ => "font/ttf",
    };

    let file_name = format!(
        "{}-{}.{}",
        sanitize_filename(&family),
        sanitize_filename(&style),
        ext
    );

    Ok(FontFileData {
        family,
        style,
        mime: mime.to_string(),
        data_base64: STANDARD.encode(&bytes),
        file_name,
    })
}

fn parse_style(style: &str) -> (Weight, Style) {
    let lower = style.to_lowercase();

    let weight = if lower.contains("black") {
        Weight::BLACK
    } else if lower.contains("extrabold") || lower.contains("extra bold") {
        Weight::EXTRA_BOLD
    } else if lower.contains("semibold") || lower.contains("semi bold") {
        Weight::SEMIBOLD
    } else if lower.contains("extralight") || lower.contains("extra light") {
        Weight::EXTRA_LIGHT
    } else if lower.contains("bold") {
        Weight::BOLD
    } else if lower.contains("medium") {
        Weight::MEDIUM
    } else if lower.contains("light") {
        Weight::LIGHT
    } else if lower.contains("thin") {
        Weight::THIN
    } else {
        Weight::NORMAL
    };

    let style_k = if lower.contains("italic") {
        Style::Italic
    } else if lower.contains("oblique") {
        Style::Oblique
    } else {
        Style::Normal
    };

    (weight, style_k)
}

fn sanitize_filename(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
#[cfg(not(debug_assertions))]
use tauri::path::BaseDirectory;
use chrono::Utc;

const MANIFEST_TTL_SECS: u64 = 3600;
const USER_AGENT: &str = "OnisoftLauncher/0.1.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub id: String,
    pub manifest_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogFile {
    pub apps: Vec<CatalogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalizedText {
    pub fr: String,
    pub en: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branding {
    pub primary_color: String,
    pub logo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionSource {
    pub source: String,
    pub repo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadSpec {
    pub asset: String,
    pub kind: String,
    #[serde(default)]
    pub match_mode: Option<String>,
    #[serde(rename = "match", default)]
    pub match_field: Option<String>,
}

impl DownloadSpec {
    fn is_glob(&self) -> bool {
        self.match_mode
            .as_deref()
            .or(self.match_field.as_deref())
            .map(|m| m.eq_ignore_ascii_case("glob"))
            .unwrap_or_else(|| self.asset.contains('*') || self.asset.contains('?'))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchOs {
    pub executable: String,
    #[serde(default)]
    pub candidates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchSpec {
    #[serde(default)]
    pub windows: Option<LaunchOs>,
    #[serde(default)]
    pub macos: Option<LaunchOs>,
    #[serde(default)]
    pub linux: Option<LaunchOs>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppManifest {
    pub id: String,
    pub name: LocalizedText,
    pub description: LocalizedText,
    pub branding: Branding,
    pub repo: String,
    pub version: VersionSource,
    pub download: HashMap<String, DownloadSpec>,
    pub launch: LaunchSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRecord {
    pub version: String,
    pub executable_path: String,
    pub kind: String,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InstallState {
    #[serde(flatten)]
    pub apps: HashMap<String, InstallRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSummary {
    pub id: String,
    pub manifest: AppManifest,
    pub remote_version: Option<String>,
    pub install: Option<InstallRecord>,
    pub manifest_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedManifest {
    fetched_at: u64,
    manifest: AppManifest,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    app_id: String,
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallStatus {
    app_id: String,
    /// downloading | installing | locating
    phase: String,
}

fn apps_root(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("apps"))
    }

    #[cfg(not(debug_assertions))]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();
        let mut push = |p: PathBuf| {
            if !candidates.iter().any(|c| c == &p) {
                candidates.push(p);
            }
        };

        // Preferred layout after fixing bundle.resources map (`../apps/` → `apps/`)
        if let Ok(p) = app.path().resolve("apps", BaseDirectory::Resource) {
            push(p);
        }
        // Legacy layout from list-style `../apps/**/*` (../ → `_up_`)
        if let Ok(p) = app.path().resolve("_up_/apps", BaseDirectory::Resource) {
            push(p);
        }
        if let Ok(rd) = app.path().resource_dir() {
            push(rd.join("apps"));
            push(rd.join("_up_").join("apps"));
        }

        for dir in &candidates {
            if dir.join("catalog.json").is_file() {
                return Ok(dir.clone());
            }
        }

        let looked = candidates
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join(", ");
        Err(format!(
            "catalog not found under resource dir (looked in: {looked})"
        ))
    }
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))
}

fn cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join("cache").join("manifests");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn apps_install_dir(app: &AppHandle, app_id: &str) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join("apps").join(app_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn install_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("install_state.json"))
}

fn read_catalog(app: &AppHandle) -> Result<CatalogFile, String> {
    let path = apps_root(app)?.join("catalog.json");
    let raw = fs::read_to_string(&path).map_err(|e| format!("read catalog: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse catalog: {e}"))
}

fn read_bundled_manifest(app: &AppHandle, id: &str) -> Result<AppManifest, String> {
    let path = apps_root(app)?.join("manifests").join(format!("{id}.json"));
    let raw = fs::read_to_string(&path).map_err(|e| format!("bundled manifest {id}: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse bundled {id}: {e}"))
}

fn now_epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn read_cache(app: &AppHandle, id: &str) -> Option<CachedManifest> {
    let path = cache_dir(app).ok()?.join(format!("{id}.json"));
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_cache(app: &AppHandle, id: &str, manifest: &AppManifest) -> Result<(), String> {
    let cached = CachedManifest {
        fetched_at: now_epoch(),
        manifest: manifest.clone(),
    };
    let path = cache_dir(app)?.join(format!("{id}.json"));
    let raw = serde_json::to_string_pretty(&cached).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())
}

fn http_client_no_redirect() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())
}

/// Resolve latest release tag without GitHub API (avoids unauthenticated 60/h rate limit).
async fn resolve_latest_tag(repo: &str) -> Result<String, String> {
    let client = http_client_no_redirect()?;
    let url = format!("https://github.com/{repo}/releases/latest");
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("resolve tag: {e}"))?;
    let location = res
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            format!(
                "could not resolve latest tag for {repo} (HTTP {})",
                res.status()
            )
        })?;
    // .../releases/tag/v3.2.4
    let tag = location
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_string();
    if tag.is_empty() || tag == "latest" {
        return Err(format!("invalid latest redirect for {repo}: {location}"));
    }
    Ok(tag)
}

fn asset_names_from_release_html(html: &str, tag: &str) -> Vec<String> {
    let needle = format!("/releases/download/{tag}/");
    let mut names = Vec::new();
    let mut rest = html;
    while let Some(idx) = rest.find(&needle) {
        let start = idx + needle.len();
        let slice = &rest[start..];
        let end = slice
            .find(|c: char| c == '"' || c == '\'' || c == '?' || c == '#' || c.is_whitespace())
            .unwrap_or(slice.len());
        let name = slice[..end].trim();
        if !name.is_empty() && !names.iter().any(|n| n == name) {
            names.push(name.to_string());
        }
        rest = &slice[end..];
    }
    names
}

/// Resolve download URL for a release asset. Prefers public GitHub URLs over api.github.com.
async fn resolve_release_asset(
    repo: &str,
    spec: &DownloadSpec,
) -> Result<(String /* version */, String /* filename */, String /* url */), String> {
    let tag = resolve_latest_tag(repo).await?;
    let version = tag.trim_start_matches('v').to_string();

    if !spec.is_glob() {
        let name = spec.asset.clone();
        let url = format!("https://github.com/{repo}/releases/latest/download/{name}");
        return Ok((version, name, url));
    }

    // Glob: scrape the public expanded-assets page (no API quota).
    let client = http_client()?;
    let page = format!("https://github.com/{repo}/releases/expanded_assets/{tag}");
    let res = client
        .get(&page)
        .send()
        .await
        .map_err(|e| format!("expanded assets: {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "could not list release assets for {repo}@{tag} (HTTP {})",
            res.status()
        ));
    }
    let html = res.text().await.map_err(|e| e.to_string())?;
    let name = asset_names_from_release_html(&html, &tag)
        .into_iter()
        .find(|n| match_asset_name(&spec.asset, true, n))
        .ok_or_else(|| format!("asset not found for glob: {}", spec.asset))?;
    let url = format!("https://github.com/{repo}/releases/download/{tag}/{name}");
    Ok((version, name, url))
}

async fn fetch_remote_manifest(url: &str) -> Result<AppManifest, String> {
    let client = http_client()?;
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("fetch manifest: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("manifest HTTP {}", res.status()));
    }
    res.json::<AppManifest>()
        .await
        .map_err(|e| format!("parse remote manifest: {e}"))
}

async fn resolve_manifest_async(
    app: &AppHandle,
    entry: &CatalogEntry,
    force: bool,
) -> Result<(AppManifest, String), String> {
    if !force {
        if let Some(cached) = read_cache(app, &entry.id) {
            if now_epoch().saturating_sub(cached.fetched_at) < MANIFEST_TTL_SECS {
                return Ok((cached.manifest, "cache".into()));
            }
        }
    }

    match fetch_remote_manifest(&entry.manifest_url).await {
        Ok(manifest) => {
            let _ = write_cache(app, &entry.id, &manifest);
            Ok((manifest, "remote".into()))
        }
        Err(_) => {
            if let Some(cached) = read_cache(app, &entry.id) {
                return Ok((cached.manifest, "cache-stale".into()));
            }
            let bundled = read_bundled_manifest(app, &entry.id)?;
            Ok((bundled, "bundled".into()))
        }
    }
}

fn read_install_state(app: &AppHandle) -> InstallState {
    let Ok(path) = install_state_path(app) else {
        return InstallState::default();
    };
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn write_install_state(app: &AppHandle, state: &InstallState) -> Result<(), String> {
    let path = install_state_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

/// Drop install records that point at missing files or installers (.msi).
fn scrub_invalid_installs(app: &AppHandle) -> InstallState {
    let mut state = read_install_state(app);
    let before = state.apps.len();
    state
        .apps
        .retain(|_, rec| is_launchable_exe(Path::new(&rec.executable_path)));
    if state.apps.len() != before {
        let _ = write_install_state(app, &state);
    }
    state
}

async fn fetch_latest_release_version(repo: &str) -> Result<String, String> {
    let tag = resolve_latest_tag(repo).await?;
    Ok(tag.trim_start_matches('v').to_string())
}

fn platform_key() -> &'static str {
    match std::env::consts::OS {
        "windows" => "windows-x86_64",
        "macos" => "darwin-universal",
        "linux" => "linux-x86_64",
        other => other,
    }
}

fn launch_for_os(manifest: &AppManifest) -> Option<&LaunchOs> {
    match std::env::consts::OS {
        "windows" => manifest.launch.windows.as_ref(),
        "macos" => manifest.launch.macos.as_ref(),
        "linux" => manifest.launch.linux.as_ref(),
        _ => None,
    }
}

fn expand_path(raw: &str) -> PathBuf {
    let mut out = raw.to_string();
    for key in ["LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "USERPROFILE", "APPDATA", "HOME"] {
        if let Ok(val) = std::env::var(key) {
            let needle = format!("%{key}%");
            out = out.replace(&needle, &val);
        }
    }
    // Also support $VAR unix style lightly
    if let Ok(home) = std::env::var("HOME") {
        if out.starts_with("~/") {
            out = format!("{home}{}", &out[1..]);
        }
    }
    PathBuf::from(out)
}

fn path_exists(path: &Path) -> bool {
    path.exists()
}

fn is_installer_artifact(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(ext.as_str(), "msi" | "msix" | "msixbundle") {
        return true;
    }
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    name.contains("setup")
        || name.contains("installer")
        || name.ends_with("-install")
        || name.ends_with("_install")
}

fn is_launchable_exe(path: &Path) -> bool {
    if !path_exists(path) {
        return false;
    }
    if is_installer_artifact(path) {
        return false;
    }
    if path.is_dir() {
        // macOS .app bundle
        return path.extension().and_then(|e| e.to_str()) == Some("app");
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(ext.as_str(), "exe" | "appimage" | "")
}

fn is_uninstaller_name(path: &Path) -> bool {
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    name.starts_with("uninstall") || name.starts_with("unins")
}

/// Look for the preferred exe in a directory (never installers / uninstallers).
fn find_exe_in_dir(dir: &Path, preferred: &str) -> Option<PathBuf> {
    if !dir.is_dir() {
        return None;
    }
    let preferred_path = dir.join(preferred);
    if is_launchable_exe(&preferred_path) {
        return Some(preferred_path);
    }

    let pref_stem = Path::new(preferred)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(preferred);
    let Ok(entries) = fs::read_dir(dir) else {
        return None;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if !is_launchable_exe(&p) || is_uninstaller_name(&p) {
            continue;
        }
        if p.file_stem()
            .and_then(|s| s.to_str())
            .is_some_and(|s| s.eq_ignore_ascii_case(pref_stem))
        {
            return Some(p);
        }
    }
    None
}

fn resolve_executable(app: &AppHandle, app_id: &str, manifest: &AppManifest) -> Option<PathBuf> {
    let state = read_install_state(app);
    if let Some(rec) = state.apps.get(app_id) {
        let p = PathBuf::from(&rec.executable_path);
        if is_launchable_exe(&p) {
            return Some(p);
        }
    }

    let launch = launch_for_os(manifest)?;

    // Prefer real install locations from the manifest before the download cache folder
    // (cache often still holds setup.exe / .msi and must not be launched as the app).
    for candidate in &launch.candidates {
        let p = expand_path(candidate);
        if is_launchable_exe(&p) {
            return Some(p);
        }
        if let Some(parent) = p.parent() {
            if let Some(found) = find_exe_in_dir(parent, &launch.executable) {
                return Some(found);
            }
        }
    }

    if let Ok(managed) = apps_install_dir(app, app_id) {
        if let Some(found) = find_exe_in_dir(&managed, &launch.executable) {
            return Some(found);
        }
    }

    None
}

fn interpret_installer_exit(code: i32) -> Result<(), String> {
    // msiexec: 0 = success, 3010 = success reboot required, 1602 = user cancelled
    // 1223 = ERROR_CANCELLED (UAC denied)
    if matches!(code, 0 | 3010) {
        return Ok(());
    }
    if matches!(code, 1602 | 1223) {
        return Err("installation cancelled".into());
    }
    Err(format!("installer exited with code {code}"))
}

#[cfg(windows)]
fn run_installer(installer: &Path) -> Result<(), String> {
    let ext = installer
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    // CreateProcess cannot trigger UAC (os error 740). Use PowerShell Start-Process -Verb RunAs.
    let path = installer.to_string_lossy().replace('\'', "''");
    let ps = if ext == "msi" {
        format!(
            "try {{ $p = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i','{path}') -Verb RunAs -Wait -PassThru; if ($null -eq $p) {{ exit 1223 }}; exit $p.ExitCode }} catch {{ exit 1223 }}"
        )
    } else {
        format!(
            "try {{ $p = Start-Process -FilePath '{path}' -Verb RunAs -Wait -PassThru; if ($null -eq $p) {{ exit 1223 }}; exit $p.ExitCode }} catch {{ exit 1223 }}"
        )
    };

    let status = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &ps,
        ])
        .status()
        .map_err(|e| format!("installer failed to start: {e}"))?;

    interpret_installer_exit(status.code().unwrap_or(-1))
}

#[cfg(not(windows))]
fn run_installer(installer: &Path) -> Result<(), String> {
    let status = Command::new(installer)
        .status()
        .map_err(|e| format!("installer failed to start: {e}"))?;
    interpret_installer_exit(status.code().unwrap_or(-1))
}

fn wait_for_executable(
    app: &AppHandle,
    app_id: &str,
    manifest: &AppManifest,
    attempts: u32,
    interval: Duration,
) -> Option<PathBuf> {
    for _ in 0..attempts {
        if let Some(path) = resolve_executable(app, app_id, manifest) {
            return Some(path);
        }
        std::thread::sleep(interval);
    }
    None
}

fn match_asset_name(pattern: &str, is_glob: bool, name: &str) -> bool {
    if !is_glob {
        return name == pattern;
    }
    glob::Pattern::new(pattern)
        .map(|p| p.matches(name))
        .unwrap_or(false)
}

#[tauri::command]
pub async fn list_apps(app: AppHandle) -> Result<Vec<AppSummary>, String> {
    let catalog = read_catalog(&app)?;
    let state = scrub_invalid_installs(&app);
    let mut out = Vec::new();

    for entry in catalog.apps {
        let (manifest, source) = resolve_manifest_async(&app, &entry, false).await?;
        let remote_version = fetch_latest_release_version(&manifest.version.repo)
            .await
            .ok();
        out.push(AppSummary {
            id: entry.id.clone(),
            install: state.apps.get(&entry.id).cloned(),
            remote_version,
            manifest,
            manifest_source: source,
        });
    }

    Ok(out)
}

#[tauri::command]
pub async fn get_app_manifest(
    app: AppHandle,
    app_id: String,
    force_refresh: Option<bool>,
) -> Result<AppSummary, String> {
    let catalog = read_catalog(&app)?;
    let entry = catalog
        .apps
        .into_iter()
        .find(|a| a.id == app_id)
        .ok_or_else(|| format!("unknown app: {app_id}"))?;
    let force = force_refresh.unwrap_or(false);
    let (manifest, source) = resolve_manifest_async(&app, &entry, force).await?;
    let remote_version = fetch_latest_release_version(&manifest.version.repo)
        .await
        .ok();
    let install = scrub_invalid_installs(&app).apps.get(&app_id).cloned();
    Ok(AppSummary {
        id: app_id,
        manifest,
        remote_version,
        install,
        manifest_source: source,
    })
}

#[tauri::command]
pub async fn refresh_manifests(app: AppHandle) -> Result<Vec<AppSummary>, String> {
    let catalog = read_catalog(&app)?;
    for entry in &catalog.apps {
        let _ = resolve_manifest_async(&app, entry, true).await;
    }
    list_apps(app).await
}

#[tauri::command]
pub fn clear_manifest_cache(app: AppHandle) -> Result<(), String> {
    let dir = cache_dir(&app)?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn download_app(app: AppHandle, app_id: String) -> Result<InstallRecord, String> {
    let summary = get_app_manifest(app.clone(), app_id.clone(), Some(false)).await?;
    let manifest = summary.manifest;
    let platform = platform_key();
    let spec = manifest
        .download
        .get(platform)
        .ok_or_else(|| format!("no download for platform {platform}"))?;

    let (version, name, url) =
        resolve_release_asset(&manifest.version.repo, spec).await?;

    let dest_dir = apps_install_dir(&app, &app_id)?;
    let dest = dest_dir.join(&name);

    let _ = app.emit(
        "install-status",
        InstallStatus {
            app_id: app_id.clone(),
            phase: "downloading".into(),
        },
    );

    let client = http_client()?;
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("download: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("download HTTP {}", response.status()));
    }
    let total = response.content_length();
    let mut stream = response.bytes_stream();
    let mut file = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                app_id: app_id.clone(),
                downloaded,
                total,
            },
        );
    }
    file.flush().await.map_err(|e| e.to_string())?;
    file.sync_all().await.map_err(|e| e.to_string())?;
    // Release the handle before msiexec/setup can open the file (Windows ERROR_SHARING_VIOLATION)
    drop(file);

    let final_path = if spec.kind == "portable" {
        let launch = launch_for_os(&manifest);
        if let Some(launch) = launch {
            let canonical = dest_dir.join(&launch.executable);
            if canonical != dest {
                fs::copy(&dest, &canonical).map_err(|e| e.to_string())?;
                canonical
            } else {
                dest.clone()
            }
        } else {
            dest.clone()
        }
    } else {
        let _ = app.emit(
            "install-status",
            InstallStatus {
                app_id: app_id.clone(),
                phase: "installing".into(),
            },
        );

        // Installers (MSI via msiexec, NSIS/setup exe directly) — wait for completion
        let installer_path = dest.clone();
        tokio::task::spawn_blocking(move || run_installer(&installer_path))
            .await
            .map_err(|e| format!("installer join: {e}"))??;

        // Clear stale install records that may point at the MSI itself
        let mut state = read_install_state(&app);
        if let Some(rec) = state.apps.get(&app_id) {
            let p = PathBuf::from(&rec.executable_path);
            if !is_launchable_exe(&p) {
                state.apps.remove(&app_id);
                let _ = write_install_state(&app, &state);
            }
        }

        let _ = app.emit(
            "install-status",
            InstallStatus {
                app_id: app_id.clone(),
                phase: "locating".into(),
            },
        );

        // Up to ~90s — NSIS/MSI can return before files are fully flushed to disk
        wait_for_executable(
            &app,
            &app_id,
            &manifest,
            90,
            Duration::from_secs(1),
        )
        .ok_or_else(|| {
            "installer finished but app executable was not found — use Detect after install completes"
                .to_string()
        })?
    };

    if !is_launchable_exe(&final_path) {
        return Err("resolved path is not a launchable application".into());
    }

    let record = InstallRecord {
        version,
        executable_path: final_path.to_string_lossy().to_string(),
        kind: spec.kind.clone(),
        installed_at: Utc::now().to_rfc3339(),
    };

    let mut state = read_install_state(&app);
    state.apps.insert(app_id, record.clone());
    write_install_state(&app, &state)?;

    Ok(record)
}

/// Launch an exe; on Windows error 740 (elevation required), retry via UAC.
fn spawn_app(path: &Path) -> Result<(), String> {
    match Command::new(path).spawn() {
        Ok(_) => Ok(()),
        Err(e) => {
            #[cfg(windows)]
            {
                if e.raw_os_error() == Some(740) {
                    return spawn_app_elevated(path);
                }
            }
            Err(format!("launch failed: {e}"))
        }
    }
}

#[cfg(windows)]
fn spawn_app_elevated(path: &Path) -> Result<(), String> {
    let path_ps = path.to_string_lossy().replace('\'', "''");
    let ps = format!(
        "try {{ Start-Process -FilePath '{path_ps}' -Verb RunAs }} catch {{ exit 1223 }}"
    );
    let status = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &ps,
        ])
        .status()
        .map_err(|e| format!("elevated launch failed: {e}"))?;
    if status.success() {
        Ok(())
    } else if status.code() == Some(1223) {
        Err("launch cancelled (elevation denied)".into())
    } else {
        Err(format!(
            "elevated launch exited with code {}",
            status.code().unwrap_or(-1)
        ))
    }
}

#[tauri::command]
pub async fn launch_app(app: AppHandle, app_id: String) -> Result<(), String> {
    let summary = get_app_manifest(app.clone(), app_id.clone(), Some(false)).await?;
    let path = resolve_executable(&app, &app_id, &summary.manifest)
        .ok_or_else(|| "application not installed or executable not found".to_string())?;

    let path = path.clone();
    tokio::task::spawn_blocking(move || spawn_app(&path))
        .await
        .map_err(|e| format!("launch join: {e}"))?
}

#[tauri::command]
pub async fn detect_install(app: AppHandle, app_id: String) -> Result<Option<InstallRecord>, String> {
    let summary = get_app_manifest(app.clone(), app_id.clone(), Some(false)).await?;
    let Some(path) = resolve_executable(&app, &app_id, &summary.manifest) else {
        return Ok(None);
    };

    let previous = read_install_state(&app).apps.get(&app_id).cloned();
    // Never stamp remote as local — Detect only rediscovers the path.
    let version = previous
        .as_ref()
        .map(|r| r.version.clone())
        .filter(|v| !v.is_empty() && v != "unknown")
        .unwrap_or_else(|| "unknown".into());
    let kind = previous
        .as_ref()
        .map(|r| r.kind.clone())
        .unwrap_or_else(|| {
            summary
                .manifest
                .download
                .get(platform_key())
                .map(|d| d.kind.clone())
                .unwrap_or_else(|| "unknown".into())
        });

    let record = InstallRecord {
        version,
        executable_path: path.to_string_lossy().to_string(),
        kind,
        installed_at: previous
            .map(|r| r.installed_at)
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
    };
    let mut state = read_install_state(&app);
    state.apps.insert(app_id, record.clone());
    write_install_state(&app, &state)?;
    Ok(Some(record))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInstallDetails {
    pub installed: bool,
    pub executable_path: Option<String>,
    pub install_dir: Option<String>,
    pub install_size_bytes: Option<u64>,
    pub cache_size_bytes: u64,
    pub version: Option<String>,
    pub kind: Option<String>,
    pub installed_at: Option<String>,
}

fn dir_size_bytes(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    let mut total = 0u64;
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            total = total.saturating_add(dir_size_bytes(&p));
        } else if let Ok(meta) = entry.metadata() {
            total = total.saturating_add(meta.len());
        }
    }
    total
}

fn clear_app_cache(app: &AppHandle, app_id: &str) {
    if let Ok(dir) = apps_install_dir(app, app_id) {
        let _ = fs::remove_dir_all(&dir);
    }
}

fn clear_install_record(app: &AppHandle, app_id: &str) -> Result<(), String> {
    let mut state = read_install_state(app);
    state.apps.remove(app_id);
    write_install_state(app, &state)
}

fn product_names_for_uninstall(manifest: &AppManifest) -> Vec<String> {
    let mut names = Vec::new();
    if let Some(launch) = launch_for_os(manifest) {
        let stem = Path::new(&launch.executable)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&launch.executable);
        if !stem.is_empty() {
            names.push(stem.to_string());
        }
    }
    if !manifest.name.en.is_empty() && !names.iter().any(|n| n == &manifest.name.en) {
        names.push(manifest.name.en.clone());
    }
    if !manifest.name.fr.is_empty() && !names.iter().any(|n| n == &manifest.name.fr) {
        names.push(manifest.name.fr.clone());
    }
    names
}

fn find_local_uninstaller(install_dir: &Path) -> Option<PathBuf> {
    const CANDIDATES: &[&str] = &[
        "uninstall.exe",
        "Uninstall.exe",
        "unins000.exe",
        "Uninstall.bat",
    ];
    for name in CANDIDATES {
        let p = install_dir.join(name);
        if p.is_file() {
            return Some(p);
        }
    }
    let Ok(entries) = fs::read_dir(install_dir) else {
        return None;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if is_uninstaller_name(&p) && p.is_file() {
            return Some(p);
        }
    }
    None
}

#[cfg(windows)]
fn run_elevated_command(file: &str, args: &str) -> Result<(), String> {
    let file_ps = file.replace('\'', "''");
    let args_ps = args.replace('\'', "''");
    let ps = if args.is_empty() {
        format!(
            "try {{ $p = Start-Process -FilePath '{file_ps}' -Verb RunAs -Wait -PassThru; if ($null -eq $p) {{ exit 1223 }}; exit $p.ExitCode }} catch {{ exit 1223 }}"
        )
    } else {
        format!(
            "try {{ $p = Start-Process -FilePath '{file_ps}' -ArgumentList '{args_ps}' -Verb RunAs -Wait -PassThru; if ($null -eq $p) {{ exit 1223 }}; exit $p.ExitCode }} catch {{ exit 1223 }}"
        )
    };
    let status = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &ps,
        ])
        .status()
        .map_err(|e| format!("uninstall failed to start: {e}"))?;
    interpret_installer_exit(status.code().unwrap_or(-1))
}

#[cfg(windows)]
fn run_uninstaller_exe(path: &Path) -> Result<(), String> {
    run_elevated_command(&path.to_string_lossy(), "")
}

/// Resolve UninstallString from Windows uninstall registry by DisplayName.
#[cfg(windows)]
fn find_registry_uninstall_command(names: &[String]) -> Option<(String, String)> {
    if names.is_empty() {
        return None;
    }
    let names_ps = names
        .iter()
        .map(|n| format!("'{}'", n.replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(",");
    let ps = format!(
        r#"
$names = @({names_ps})
$paths = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$app = Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object {{
  $dn = $_.DisplayName
  if (-not $dn) {{ return $false }}
  foreach ($n in $names) {{ if ($dn -like ("*" + $n + "*")) {{ return $true }} }}
  $false
}} | Select-Object -First 1
if (-not $app -or -not $app.UninstallString) {{ exit 2 }}
$u = [string]$app.UninstallString
if ($u.StartsWith([char]34)) {{
  $end = $u.IndexOf([char]34, 1)
  if ($end -lt 1) {{ exit 3 }}
  $file = $u.Substring(1, $end - 1)
  $arg = $u.Substring($end + 1).Trim()
}} else {{
  $parts = $u -split '\s+', 2
  $file = $parts[0]
  $arg = if ($parts.Length -gt 1) {{ $parts[1] }} else {{ '' }}
}}
Write-Output $file
Write-Output $arg
"#
    );
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &ps,
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut lines = text.lines().map(str::trim).filter(|l| !l.is_empty());
    let file = lines.next()?.to_string();
    let args = lines.next().unwrap_or("").to_string();
    if file.is_empty() {
        return None;
    }
    Some((file, args))
}

#[cfg(windows)]
fn uninstall_windows(install_dir: &Path, names: &[String]) -> Result<(), String> {
    if let Some(uninstaller) = find_local_uninstaller(install_dir) {
        return run_uninstaller_exe(&uninstaller);
    }
    if let Some((file, args)) = find_registry_uninstall_command(names) {
        return run_elevated_command(&file, &args);
    }
    Err(
        "no uninstaller found — uninstall the app from Windows Settings, then Detect"
            .into(),
    )
}

#[cfg(not(windows))]
fn uninstall_windows(_install_dir: &Path, _names: &[String]) -> Result<(), String> {
    Err("uninstall is only supported on Windows for now".into())
}

#[tauri::command]
pub async fn get_app_details(
    app: AppHandle,
    app_id: String,
) -> Result<AppInstallDetails, String> {
    let summary = get_app_manifest(app.clone(), app_id.clone(), Some(false)).await?;
    let cache_dir = apps_install_dir(&app, &app_id)?;
    let cache_size_bytes = dir_size_bytes(&cache_dir);

    let path = resolve_executable(&app, &app_id, &summary.manifest)
        .or_else(|| {
            summary
                .install
                .as_ref()
                .map(|r| PathBuf::from(&r.executable_path))
                .filter(|p| p.exists())
        });

    let Some(exe) = path else {
        return Ok(AppInstallDetails {
            installed: false,
            executable_path: None,
            install_dir: None,
            install_size_bytes: None,
            cache_size_bytes,
            version: summary.install.as_ref().map(|r| r.version.clone()),
            kind: summary.install.as_ref().map(|r| r.kind.clone()),
            installed_at: summary.install.as_ref().map(|r| r.installed_at.clone()),
        });
    };

    let install_dir = exe.parent().map(|p| p.to_path_buf());
    let install_size_bytes = install_dir.as_ref().map(|d| dir_size_bytes(d));
    let record = summary.install;

    Ok(AppInstallDetails {
        installed: true,
        executable_path: Some(exe.to_string_lossy().to_string()),
        install_dir: install_dir.map(|p| p.to_string_lossy().to_string()),
        install_size_bytes,
        cache_size_bytes,
        version: record.as_ref().map(|r| r.version.clone()),
        kind: record.as_ref().map(|r| r.kind.clone()),
        installed_at: record.as_ref().map(|r| r.installed_at.clone()),
    })
}

#[tauri::command]
pub async fn uninstall_app(app: AppHandle, app_id: String) -> Result<(), String> {
    let summary = get_app_manifest(app.clone(), app_id.clone(), Some(false)).await?;
    let exe = resolve_executable(&app, &app_id, &summary.manifest)
        .or_else(|| {
            summary
                .install
                .as_ref()
                .map(|r| PathBuf::from(&r.executable_path))
                .filter(|p| p.exists())
        })
        .ok_or_else(|| "application not installed or executable not found".to_string())?;

    let install_dir = exe
        .parent()
        .ok_or_else(|| "invalid install path".to_string())?
        .to_path_buf();
    let names = product_names_for_uninstall(&summary.manifest);

    let _ = app.emit(
        "install-status",
        InstallStatus {
            app_id: app_id.clone(),
            phase: "uninstalling".into(),
        },
    );

    let install_dir_cb = install_dir.clone();
    let names_cb = names.clone();
    tokio::task::spawn_blocking(move || uninstall_windows(&install_dir_cb, &names_cb))
        .await
        .map_err(|e| format!("uninstall join: {e}"))??;

    // Give the uninstaller a moment to finish deleting files
    for _ in 0..15 {
        if !exe.exists() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(400)).await;
    }

    clear_app_cache(&app, &app_id);
    clear_install_record(&app, &app_id)?;

    if exe.exists() {
        return Err(
            "uninstaller finished but files are still present — check Windows Settings"
                .into(),
        );
    }

    Ok(())
}

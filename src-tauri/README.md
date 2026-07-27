# Architecture Rust Backend

## Structure

```
src-tauri/
├── src/
│   ├── lib.rs                 # Tauri builder, window icon, command handler
│   ├── main.rs                # Binary entry
│   └── commands/
│       ├── mod.rs
│       └── apps.rs            # Catalog, manifests, download/install/launch/uninstall
├── capabilities/
│   └── default.json
├── icons/
├── Cargo.toml
└── tauri.conf.json
```

## Commands (`commands/apps.rs`)

| Command | Role |
|---|---|
| `list_apps` | Resolve catalog + manifests + install state |
| `get_app_manifest` | One app summary (optional force refresh) |
| `refresh_manifests` | Force-refresh all remote manifests |
| `clear_manifest_cache` | Wipe local manifest cache |
| `download_app` | Download release asset + run installer + locate exe |
| `launch_app` | Launch installed executable |
| `detect_install` | Rediscover install path from manifest candidates |
| `get_app_details` | Disk size, paths, cache size |
| `uninstall_app` | Run Windows uninstaller + clear launcher state |

Catalog and bundled manifests are loaded from `apps/` (dev: repo root; release: `$RESOURCE/apps/` via `bundle.resources`).

## Adding a command

1. Implement `#[tauri::command]` in `commands/apps.rs` (or a new module).
2. `pub use` from `commands/mod.rs` if needed.
3. Register in `lib.rs` `generate_handler![…]`.
4. Add a typed wrapper in `src/lib/apps.ts`.

## Plugins

- `tauri-plugin-opener` — open external URLs
- `tauri-plugin-updater` — signed auto-updates
- `tauri-plugin-process` — relaunch after update

## Practices

1. Keep IPC coarse and typed (`Result<T, String>`).
2. Validate `app_id` against the catalog; never trust path arguments from the webview.
3. Prefer public GitHub release URLs over `api.github.com` for downloads.
4. Document public commands briefly.

## Calling from React

```typescript
import { downloadApp, launchApp, uninstallApp } from "@/lib/apps";

await downloadApp("multitool");
await launchApp("multitool");
await uninstallApp("multitool");
```

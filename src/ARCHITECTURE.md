# Architecture — Onisoft Launcher

Desktop-only Tauri app (no web deployment target).

## Folder structure

```
OnisoftLauncher/
├── apps/                     # Catalog + bundled manifests (source of truth)
│   ├── catalog.json
│   └── manifests/
│       ├── multitool.json
│       ├── pictools.json
│       └── flowsint.json
├── templates/                # Manifest template + schema + how-to
│   ├── onisoft.manifest.json
│   ├── onisoft.manifest.schema.json
│   └── README.md
├── public/                   # Static assets (Onisoft.png, favicon)
├── src/
│   ├── pages/                # Routes
│   │   ├── Home.tsx
│   │   ├── AppDetail.tsx
│   │   ├── Settings.tsx
│   │   ├── Update.tsx
│   │   └── NotFound.tsx
│   ├── components/           # UI (TitleBar, AppDock, Splash, ConfirmDialog, …)
│   ├── composables/          # Hooks (useApps, useTheme, useLanguage, useWindow, …)
│   ├── i18n/                 # EN / FR locales
│   ├── layouts/              # RootLayout
│   ├── router/               # MemoryRouter
│   ├── lib/                  # IPC helpers, color, format, app-status
│   ├── types/                # AppSummary, manifests, …
│   └── constants/
└── src-tauri/                # Rust backend (see src-tauri/README.md)
```

## Conventions

- **Pages**: one route per file, PascalCase, default export
- **Composables**: `use` prefix; export from `composables/index.ts` when shared
- **Lib**: pure helpers + typed `invoke` wrappers (`src/lib/apps.ts`)
- **Types**: shared TS types under `src/types/`
- **Constants**: `UPPER_SNAKE_CASE`

## Catalog & manifests

Manifests live **only in this repo** (`apps/manifests/<id>.json`).  
`apps/catalog.json` lists each app and a `manifestUrl` pointing at the raw GitHub copy in **Onisoft-Launcher**.  
If the remote fetch fails, the launcher falls back to the bundled file.

How to add an app: see [`templates/README.md`](../templates/README.md).

## Adding a page

1. Create `src/pages/MyPage.tsx`
2. Register the route in `src/router/index.tsx`
3. Add `en` / `fr` strings under `src/i18n/locales/`

## Dependencies (frontend)

- React Router (`MemoryRouter`)
- TailwindCSS v4
- Lucide React
- Tauri v2 + plugins **opener**, **updater**, **process**
- react-i18next
- shadcn-style primitives (`components/ui`)

## Composables

- `useApps` — catalog, install/launch/uninstall, progress
- `useLocalStorage` — persistence
- `useTheme` — light / dark / system
- `useLanguage` — en / fr
- `useWindow` — window chrome controls

UI modals: in-app components (e.g. `ConfirmDialog`), not the notification plugin.

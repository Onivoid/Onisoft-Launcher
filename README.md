# Onisoft Launcher

Launcher desktop pour l’écosystème Onisoft — basé sur Tauri v2, React 19, TypeScript et TailwindCSS.

[![Tauri](https://img.shields.io/badge/Tauri-2.x-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

## Features

- Vite + React 19 + TypeScript
- Tauri v2 (desktop léger)
- TailwindCSS v4 + shadcn/ui
- Thème clair / sombre / système
- i18n (EN / FR)
- Auto-updates signés (plugin updater)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v8+)
- [Rust](https://www.rust-lang.org/) (latest stable)

### Installation

```bash
git clone https://github.com/Onivoid/Onisoft-Launcher.git
cd Onisoft-Launcher

pnpm install
pnpm tauri dev
pnpm tauri build
```

## Documentation

- **[Architecture](src/ARCHITECTURE.md)** — structure et conventions
- **[Ajouter une app](templates/README.md)** — manifests dans `apps/manifests/` + catalog
- **[Tauri Plugins](TAURI_PLUGINS.md)** — configuration des plugins
- **[Rust Backend](src-tauri/README.md)** — organisation Rust

## Catalogue

Les manifests des apps sont **centralisés** dans ce dépôt (`apps/catalog.json` + `apps/manifests/`). Pas besoin de `onisoft.manifest.json` dans chaque repo d’app.
## Scripts

```bash
pnpm dev          # Frontend Vite
pnpm build        # Build frontend
pnpm tauri dev    # App Tauri (dev)
pnpm tauri build  # Build production
```

## Version bump (optional)

```bash
VERSION_BUMP=1 git commit -m "chore: bump version"
# then: git push origin vX.Y.Z
```

Sans `VERSION_BUMP=1`, les commits passent normalement.

Les hooks git sont installés automatiquement via `pnpm install` (`prepare` → `node scripts/setup-hooks.mjs`, compatible Windows / macOS / Linux).

## Auto-Update

Configurer dans `src-tauri/tauri.conf.json` :

1. Générer des clés : `pnpm tauri signer generate -w ~/.tauri/onisoft-launcher.key`
2. Secrets GitHub : `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. Mettre à jour la `pubkey` dans `tauri.conf.json`
4. Endpoint actuel : `https://github.com/Onivoid/Onisoft-Launcher/releases/latest/download/latest.json`

## License

[AGPL-3.0](LICENSE)

## Support

- [GitHub Issues](https://github.com/Onivoid/Onisoft-Launcher/issues)
- [Tauri Documentation](https://tauri.app/v2/guides/)

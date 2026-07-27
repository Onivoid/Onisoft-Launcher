# Ajouter une app au Onisoft Launcher

Les manifests vivent **uniquement dans ce repo** (`apps/manifests/`). Pas besoin d’un `onisoft.manifest.json` dans le dépôt de l’app.

## Prérequis

1. L’app a au moins **une release GitHub** avec un installateur Windows (NSIS `*-setup.exe` ou **MSI** `*_en-US.msi`).
2. Le dépôt (ou au minimum les **Releases**) est **public** — le launcher télécharge sans token GitHub.
3. Préférer un **installateur** (pas un portable `.exe` seul), pour que l’updater Tauri de l’app continue de fonctionner.

## Étape 1 — Créer le manifest

1. Copie [`onisoft.manifest.json`](./onisoft.manifest.json) vers :

```text
apps/manifests/<id>.json
```

2. Remplis les champs (voir tableau plus bas). L’`id` doit être un slug stable (minuscules, sans espaces).
3. Optionnel : garde le `$schema` pointant vers [`onisoft.manifest.schema.json`](./onisoft.manifest.schema.json) pour l’autocomplétion IDE.

## Étape 2 — Catalog

Dans `apps/catalog.json`, ajoute :

```json
{
  "id": "mon-slug",
  "manifestUrl": "https://raw.githubusercontent.com/Onivoid/Onisoft-Launcher/main/apps/manifests/mon-slug.json"
}
```

- `id` = même valeur que dans le manifest.
- `manifestUrl` = raw GitHub du fichier dans **ce** repo (après push).
- En local / avant push : si le remote 404, le launcher utilise automatiquement le fichier bundlé `apps/manifests/<id>.json`.

## Étape 3 — Vérifier la release

Sur la page Releases de l’app, le nom d’asset doit correspondre à `download.windows-x86_64.asset` :

| Mode | Exemple | Quand |
|---|---|---|
| Nom exact | `Multitool-Installer.msi` | Nom fixe à chaque release |
| Glob | `"asset": "MonApp_*_x64_en-US.msi", "match": "glob"` | Le numéro de version change dans le nom |

Préférence Windows : **MSI** ou setup NSIS, `kind: "installer"`.

## Étape 4 — Chemins de lancement

Renseigne `launch.windows.executable` (= `productName` Tauri + `.exe`) et des `candidates` réalistes :

```text
%PROGRAMFILES%/MonApp/MonApp.exe
%LOCALAPPDATA%/Programs/MonApp/MonApp.exe
```

Astuces :

- `installMode: "perMachine"` → souvent `%PROGRAMFILES%`.
- Mode utilisateur → souvent `%LOCALAPPDATA%/Programs/…`.
- Si le `name` dans `Cargo.toml` ≠ `productName`, ajoute aussi `nom-cargo.exe` (ex. Multitool → `sandbox.exe`).

## Étape 5 — Tester

1. Relance le launcher (ou rafraîchis les manifests).
2. Installe → ouvre → vérifie la détection de version.
3. Corrige le manifest bundlé si besoin, puis commit / push quand c’est bon.

## Checklist rapide

- [ ] Release GitHub publique avec MSI ou setup
- [ ] `apps/manifests/<id>.json` rempli
- [ ] Entrée dans `apps/catalog.json`
- [ ] Logo en **URL absolue publique** (raw de l’app, CDN, ou `/app-icons/….png` dans `public/` du launcher)
- [ ] Test Installer → Ouvrir dans le launcher

## Champs du manifest

| Champ | Rôle |
|---|---|
| `id` | Slug stable (= entrée catalog) |
| `name` / `description` | Localisés `fr` / `en` |
| `branding.primaryColor` | Accent hex dans l’UI |
| `branding.logo` | URL image (publique) |
| `repo` | URL GitHub du projet |
| `version.source` | `github-releases` |
| `version.repo` | `owner/name` |
| `download.<platform>` | `asset` + `kind` (`installer` \| `archive`) ; `match: "glob"` si besoin |
| `launch.<os>` | `executable` + `candidates` |

## Plateformes

- `windows-x86_64`
- `darwin-universal`
- `linux-x86_64`

Le MVP actuel cible surtout Windows ; les autres clés sont prêtes pour plus tard.

## Repo privé

Le launcher **ne peut pas** télécharger les assets d’un repo privé (pas de token). Passe le dépôt / les releases en public avant d’ajouter l’app.

## Règle : pas de builds portables seuls

Les apps Onisoft doivent proposer le canal **installateur / MSI / setup** (ou l’archive utilisée par l’updater Tauri). Un `.exe` portable dans le cache du launcher contourne l’updater natif de l’app.

# Claude for Zotero

A Zotero 10 plugin that answers questions about the paper you are reading with
your existing Claude subscription, by running the locally installed Claude Code
CLI in the background. Domain terms are defined in
[docs/GLOSSARY.md](docs/GLOSSARY.md); design decisions are in [docs/adr/](docs/adr/).

Status: scaffold only. The plugin installs and loads, but has no visible
features yet.

## Requirements

- Node.js 22.8 or newer (zotero-plugin-scaffold 0.9.x).
- Zotero 10.0.x. The manifest targets `10.0` to `10.0.*` only.

## Build

```sh
npm install
npm run build
```

The plugin is written to `.scaffold/build/claude-for-zotero.xpi`. Install it in
Zotero with Tools → Plugins → gear menu → Install Plugin From File.

The manifest's `update_url` points at a release manifest that does not exist,
so auto-update is inert on purpose.

## Test

```sh
npm test           # vitest: unit tests plus type-level tests (tests/unit)
npm run typecheck  # tsc --noEmit over src and tests
```

Unit tests run under Node with no Zotero. Zotero-dependent code (registration,
UI) is checked by hand in Zotero.

## Develop

`npm start` runs `zotero-plugin serve`: it builds the plugin, starts a separate
Zotero instance with it installed, and rebuilds and reloads on changes. Create
a `.env` file (git-ignored) first:

```sh
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=C:/Program Files/Zotero/zotero.exe
# Optional; these defaults are throwaway folders inside the repo:
# ZOTERO_PLUGIN_PROFILE_PATH=./.scaffold/profile
# ZOTERO_PLUGIN_DATA_DIR=./.scaffold/data
```

Never point the profile or data directory at your real Zotero profile or
library: the dev instance writes to both. The config passes `-no-remote` so the
dev instance does not attach to a Zotero that is already running.

## Layout

- `addon/`: static plugin files (`bootstrap.js`, `manifest.json`, default `prefs.js`,
  and the preferences pane markup `content/preferences.xhtml`).
- `src/core/`: Zotero-free modules and shared types (Claude Runner, Process
  Port, Context Builder, Thread Store, Answer Renderer, preference schema,
  CLI path resolution).
- `src/modules/`: Zotero-dependent modules (Claude Pane, reader popup,
  preferences pane, preference accessors, CLI locator: `getCliPath()`).
- `src/hooks.ts`: lifecycle; startup and shutdown call one registration
  function per feature.
- `src/prefs-pane-entry.ts`: second bundle, `content/scripts/claudeforzotero-prefs.js`,
  loaded by Zotero with the preferences pane.

## Known build quirk

`package.json` overrides `@swc/core` (used by the scaffold) to 1.16.2. Versions
1.16.12 and later refuse to load on a machine where no candidate cache
directory passes their ACL check (`ERR_SWC_NATIVE_CACHE`).

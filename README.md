# Claude for Zotero

A Zotero 10 plugin that answers questions about the paper you are reading with
your existing Claude subscription, by running the locally installed Claude Code
CLI in the background. Domain terms are defined in
[docs/GLOSSARY.md](docs/GLOSSARY.md); design decisions are in [docs/adr/](docs/adr/).

## What it does

- **Claude Pane:** a Claude section in the item pane and in the reader's
  context pane. It holds one Thread per item: ask a question, follow up, pick
  the model, stop a running Answer, or clear the Thread. Threads last until
  Zotero closes.
- **Ask Claude Button and Inline Card:** select text in a PDF and press Ask
  Claude in the selection popup. A card opens next to the Selection with the
  Quick Actions Explain, Define and Explain the math, or a typed Inline
  Question. Continue in Pane moves the exchange into the item's Thread.
- **Context:** every question carries the Item Context (title, authors, year,
  abstract). Claude reads the paper (Paper Context) when it judges the question
  needs it, or always when "Use full paper" is ticked. Inline Questions also
  send a picture of the Selection, so typeset equations and figures come through.
- **Answers** render as Markdown with math (KaTeX).
- **Saving:** nothing is written to your library unless you press a save
  button. An Answer or a whole Thread can be saved as a child note, and an
  Inline Question and its Answer as a highlight annotation on the Selection.
- **Isolation:** each run uses only the plugin's own system prompt, no MCP
  servers, hooks or your Claude Code settings, and at most the Read tool limited
  to the paper's files. See the ADR for the exact invocation.
- **Settings → Claude:** the CLI path (auto-detected), the default model, the
  Answer language and an "About me" line sent with every question.

## Requirements

- Zotero 10.0.x. The manifest targets `10.0` to `10.0.*` only.
- Claude Code installed as the native `claude.exe` and signed in (`claude`
  works in a terminal). The plugin finds it on PATH or at
  `~/.local/bin/claude.exe`, or you set its path in Settings → Claude. On
  Windows only a `.exe` is run: an npm `claude` or `claude.cmd` shim is not
  used, for security (see the ADR).
- Optional, to let Claude read PDF pages (equations, figures, tables): a full
  poppler, for example winget `oschwartz10612.Poppler`, ahead of TeX Live on
  PATH. TeX Live's `pdftoppm` lacks JPEG support and does not work. Without
  poppler, Claude uses the paper's text file, which Zotero extracts.
- To build: Node.js 22.8 or newer (zotero-plugin-scaffold 0.9.x).

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

Unit tests run under Node with no Zotero. Zotero-dependent behaviour is checked
by hand: [docs/manual-checks/iss-1-manual-checklist.md](docs/manual-checks/iss-1-manual-checklist.md)
walks through every user story, with the per-feature lists in the same folder.

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

- `addon/`: static plugin files: `bootstrap.js`, `manifest.json`, default
  `prefs.js`, the preferences pane markup `content/preferences.xhtml`, the
  pane stylesheet, icons, locale strings and the KaTeX assets (copied in by
  `scripts/copy-katex-assets.mjs` before each build).
- `src/core/`: Zotero-free modules and shared types (`types.ts`).
  - Running the CLI: `runner.ts` (Claude Runner), `process-port.ts` (Process
    Port), `process-args.ts`, `cli-invocation.ts`, `stream-parser.ts`,
    `failure.ts`, `cli-path.ts` (CLI path resolution and the `.exe` rule).
  - Questions and Threads: `ask-controller.ts`, `context-builder.ts`,
    `item-context.ts`, `item-pdf.ts`, `paper-context.ts`, `thread-store.ts`,
    `continue-in-pane.ts`.
  - Answers: `answer-renderer.ts`, `markdown-math.ts`, `safe-html.ts`,
    `safe-link.ts`.
  - Inline Card and saving: `card-placement.ts`, `selection-crop.ts`,
    `saving.ts`.
  - Preferences: `prefs-schema.ts`, `prefs-pane-text.ts`.
- `src/modules/`: Zotero-dependent modules.
  - Claude Pane: `claude-pane.ts` (registration and wiring),
    `claude-pane-view.ts` (DOM).
  - Inline Card: `reader-popup.ts` (Ask Claude Button and wiring),
    `inline-card.ts`, `inline-card-css.ts`, `selection-snapshot.ts`.
  - Saving: `save-button.ts`, `library-writer.ts` (the only library writes).
  - CLI: `cli-locator.ts` (`getCliPath()`), `cli-workdir.ts`,
    `subprocess-port.ts` (the production Process Port).
  - Preferences: `prefs.ts`, `prefs-pane.ts`, `prefs-pane-window.ts`.
  - `errors.ts`: shared `logError` and `guard`.
- `src/hooks.ts`: lifecycle; startup and shutdown call one registration
  function per feature. `src/index.ts` is the bundle entry.
- `src/prefs-pane-entry.ts`: second bundle, `content/scripts/claudeforzotero-prefs.js`,
  loaded by Zotero with the preferences pane.

## Known build quirk

`package.json` overrides `@swc/core` (used by the scaffold) to 1.16.2. Versions
1.16.12 and later refuse to load on a machine where no candidate cache
directory passes their ACL check (`ERR_SWC_NATIVE_CACHE`).

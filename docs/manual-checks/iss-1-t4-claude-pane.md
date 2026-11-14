> Part of the consolidated checklist: [iss-1-manual-checklist.md](iss-1-manual-checklist.md). Run that for the full pass; this file holds the detailed steps it refers to.

# Manual checks: Claude Pane (#4)

Run against Zotero 10.0.x with the built `.scaffold/build/claude-for-zotero.xpi` installed, or through `npm start` (its own profile and data directory; see README). User story numbers refer to the spec in #1. #11 folds this list into the full checklist.

Preparation: a library with a regular item that has a PDF child, a second regular item, a standalone PDF (no parent), and a note. Claude Code signed in (`claude` works in a terminal). Keep Task Manager or Process Explorer open on the Details tab for `claude.exe`.

## Pane, sidenav and Threads

| # | Step | Expected |
|---|------|----------|
| 1 | Open the PDF of the regular item in a reader tab and open the context pane. | A section headed **Claude** with the speech-bubble icon is in the side pane. |
| 2 | In that reader tab, look at the side navigation strip and click the Claude icon. | A Claude button with tooltip **Claude** is there; clicking it scrolls to the Claude section. |
| 3 | In the library, select the regular item. | The same Claude section is in the item pane, with its sidenav button. |
| 4 | Ask a question in the library pane, then switch to the reader tab of the same item (or the reverse) while the Answer streams. | Both panes show the same Thread and the same streaming text; Send/Stop and Clear match in both. |
| 5 | Select the second regular item. | Its Claude section is empty; the first item's Thread is untouched when you go back. |
| 6 | Open the standalone PDF and ask a question; then select that PDF in the library. | The reader pane works, and the library pane for the PDF shows the same Thread. |
| 6b | Select the PDF child of the first item in the library. | The Claude section shows the parent item's Thread. |
| 6c | Select a note. | No Claude section (disabled for notes). |
| 7 | Type a question and press Enter; type another and click Send. Press Shift+Enter in the input. | Enter and Send both ask and empty the input; Shift+Enter adds a new line without sending. Keys typed in the input do not trigger Zotero shortcuts or item-pane navigation. |
| 8 | Ask "What is my name?" after first saying "My name is Ada" in the same Thread. | Claude remembers the earlier turn (the run resumed the session). |
| 9 | Switch items and tabs, then come back. | The Thread is still there. |
| 10 | Restart Zotero. | Every Thread is gone. |
| 11 | With turns in a Thread, click Clear, also once while an Answer is streaming. | The Thread empties; a streaming Answer stops, its `claude.exe` exits, and no late text appears. Clear is disabled on an empty Thread. |
| — | While an Answer streams, press Enter or click Send with new text; also press Enter on an empty or blank input. | Nothing happens; the typed text stays in the input. |
| — | Pick Haiku in the model picker and ask. Open a new reader tab. | The question runs with `--model haiku` (Process Explorer command line). A new pane starts at the default model from Settings → Claude. |
| — | Click Stop while an Answer streams. | The partial Answer stays, followed by `Stopped.`; the button returns to Send. |

## Backend, privacy and errors

| # | Step | Expected |
|---|------|----------|
| 51 | Ask with no API key set anywhere. | The Answer comes from the local Claude Code login. |
| 52 | Ask "Which MCP servers, connectors, skills or hooks do you have?" | None; no connector or hook loads. Process Explorer shows `--strict-mcp-config --setting-sources=` on the command line. |
| 53 | Ask "List your tools" or "Read C:\Windows\win.ini". | No tools; nothing is read. The command line ends with `--tools=`. |
| 54 | Set Settings → Claude → CLI path to `C:\nope\claude.exe` and ask. | `Claude Code CLI not found. Install Claude Code, or set its path in Settings → Claude.` Clear the override afterwards. |
| 55 | Sign out (`claude` → `/logout` in a terminal) and ask; sign in again afterwards. | `Claude Code is not signed in. Run \`claude\` in a terminal and sign in, then ask again.` |
| 56 | If a usage limit is ever hit, ask. (Patterns are unverified in #4.) | `You've reached your Claude usage limit. Try again later.` |
| 57 | Cause a failure (for example the bad CLI path above) and watch for 10 s. | One error, one spawn: no second `claude.exe` starts. |
| 58 | Start a long Answer, then (a) click Clear, (b) start another and disable the plugin in Tools → Plugins, (c) start another and quit Zotero. | In each case `claude.exe` disappears from Task Manager within a few seconds. |

## Checks that could not be made without running Zotero

| Check | Step | Expected |
|-------|------|----------|
| Empty-value arguments | Process Explorer → `claude.exe` → command line during a run. | It contains `--setting-sources=` and `--tools=` and every other argument of the ADR in order. Subprocess on Windows drops a bare `""` argument, so the plugin sends `--name=`; the CLI parses that as an empty value (verified with CLI 2.1.322 outside Zotero). |
| PATH inside Zotero | Start Zotero from the Start menu, clear the CLI path override, ask. | The CLI is found (PATH or the `~/.local/bin/claude.exe` fallback). |
| UTF-8 streaming | Ask "Reply with: λ ∑ é 漢字 日本語 and an emoji, repeated 50 times." | Every character comes out intact while streaming and after; no `�`. |
| Fluent strings | Look at the section header and hover the sidenav button, in the library and in a reader tab, also in a second main window if one is open. | Header reads **Claude**, tooltip **Claude**; never empty or a raw message ID. After disabling and re-enabling the plugin they still show. |
| Icons | Switch Zotero between light and dark appearance. | Header and sidenav icons are visible and follow the text colour in both. |
| Working directory | After a few questions, open `<Zotero data dir>\claude-for-zotero\cli-workdir`. | The folder exists and is empty. Follow-ups still resume (row 8). |
| Large stderr | Not reproducible on demand; covered by the adapter draining stderr from spawn time. | — |
| Disable/enable | Disable the plugin in Tools → Plugins, then enable it. | The Claude section and sidenav button disappear and come back; no errors in Help → Debug Output Logging mentioning Claude Pane. |

# Manual checklist: Claude for Zotero on Zotero 10.0.8 (#11)

One pass through every user story of the spec in #1, run once against Zotero 10.0.8. The per-ticket lists (`iss-1-t4-claude-pane.md`, `-t6-markdown-math.md`, `-t7-inline-card.md`, `-t8-paper-context.md`, `-t9-saving.md`, `-t10-continue-in-pane.md`) in this folder are part of this checklist. Their rows, Expected columns and "watch for these" sections are the detail; this file orders them, adds the steps they lack (preferences, force phrases, lifecycle) and maps every story to a step.

**Step IDs.** `T4-3` means row 3 of the t4 file, `T9-7b` row 7b of the t9 file, and so on. Rows in t4 with a "—" number are named `T4-a` (Enter or Send while streaming, blank input), `T4-b` (model picker), `T4-c` (Stop). The t4 table "Checks that could not be made without running Zotero" is `T4-X1` to `T4-X8` in table order (empty-value arguments, PATH, UTF-8, Fluent strings, icons, working directory, large stderr, disable/enable). Steps new in this file start with `C-` (consolidated) or `L-` (lifecycle). Run a `T` step exactly as its file says, then record its result in the table of section 2.

## 1. Setup

1. **Use a separate, throwaway Zotero profile and data directory. Never your everyday profile or library.**
   - Close Zotero, then start the profile manager: `"C:\Program Files\Zotero\zotero.exe" -P` (adjust the path to your install). Click **Create Profile...**, name it `claude-test`, and choose a new empty folder for it (for example `C:\ZoteroTest\profile`). Start Zotero with that profile.
   - In the test profile open Settings → Advanced → Files and Folders → Data Directory Location, choose **Custom...**, and pick a new empty folder (for example `C:\ZoteroTest\data`). Zotero restarts. Check that the path shown is the test folder.
   - Do not sign in to Zotero sync in this profile. Never point it at `%APPDATA%\Zotero` or your normal data folder.
   - Alternative: `npm start` (README, "Develop") runs a dev instance with its own `.scaffold/profile` and `.scaffold/data`.
2. **Build.** From the repo root run `npm install` (first time) and `npm run build`. The plugin is `.scaffold/build/claude-for-zotero.xpi` (`dist` and `xpiName` in `zotero-plugin.config.ts`). Also run `npm test`; note any failures in the Results section.
3. **Install.** In the test profile: Tools → Plugins → gear menu → Install Plugin From File, pick the .xpi. The plugin shows as **Claude for Zotero**, enabled. Zotero 10.0.8 is the only supported version (`strict_max_version` `10.0.*`).
4. **Claude Code.** The CLI must be signed in: `claude` works in a terminal and answers a prompt. Record `claude --version` in the Results section.
5. **Test library, no personal data.** In the test profile only, add public items, for example a public-domain arXiv paper (add it by its arXiv identifier) with its PDF. Create the preparation items listed in each per-ticket file: items A to E of t8 (with the `C:\Test papers\...` linked PDFs and `secret.txt` containing `PELICAN-42`), the standalone PDF, an EPUB, a web snapshot, a note, and a read-only group library item if you have one. Use only content that is safe to send to Claude: each question sends the item's title, authors, year and abstract, and Paper Context sends the PDF.
6. **Observation tools.**
   - Help → Debug Output Logging → Enable. Read errors afterwards under Help → Debug Output Logging → View Output, or in the Error Console (Tools → Developer → Error Console).
   - Task Manager (Details tab) or Process Explorer for `claude.exe` and its command line. A command-line view in PowerShell: `Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Select-Object ProcessId,CommandLine`. The plugin's runs always contain `--strict-mcp-config`; use that to tell them apart from any `claude` sessions you have open yourself.
   - Baseline: write down `tasklist /FI "IMAGENAME eq claude.exe"` before you start, so you know which processes are not the plugin's.
7. Settings → Claude → Default model: Sonnet, CLI path empty, unless a step says otherwise.

## 2. Story coverage

Result column: pass, fail or notes; link an issue for each fail. Every story has a manual step.

| Story | Title | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Claude section in the reader context pane | T4-1 | Section headed **Claude** with the speech-bubble icon next to an open PDF | |
| 2 | Claude button in the context pane sidenav | T4-2, T4-X4 | Sidenav button with tooltip **Claude** scrolls to the section | |
| 3 | Same pane in the library item pane | T4-3 | Claude section and sidenav button on a selected item | |
| 4 | Library and reader share one Thread | T4-4, T10-10 | Both panes show the same Thread and streaming text | |
| 5 | One Thread per parent item | T4-5 | Second item's pane is empty; first item's Thread untouched | |
| 6 | Standalone PDF owns its Thread | T4-6, T4-6b, T4-6c | Works for a parentless PDF; PDF child shows parent's Thread; note has no section | |
| 7 | Enter or Send asks | T4-7, T4-a | Enter and Send ask; Shift+Enter adds a line; no Zotero shortcuts fire | |
| 8 | Follow-ups remember earlier turns | T4-8 | "What is my name?" answered from the earlier turn | |
| 9 | Thread stays while Zotero is open | T4-9 | Thread survives switching items and tabs | |
| 10 | Threads vanish on quit | T4-10 | Every Thread gone after restart | |
| 11 | Clear a Thread | T4-11 | Thread empties, streaming Answer stops, Clear disabled when empty | |
| 12 | Ask Claude Button in selection popup | T7-1 | **Ask Claude** button under the colour buttons | |
| 13 | Inline Card pinned next to Selection | T7-3 | About 320px card below/above the Selection with the listed controls | |
| 14 | Card stays anchored on scroll | T7-11, T7-12, T7-13 | Card follows scroll, zoom, resize, split view; hides when off-screen | |
| 15 | One card at a time | T7-14, T7-15 | New Selection replaces the card and ends the old run, also across tabs | |
| 16 | Close with ✕ or Esc | T7-16 | Card closes and the run is cancelled | |
| 17 | Explain Quick Action | T7-4 | "Explain" shows as the question; Answer explains the passage | |
| 18 | Define Quick Action | T7-5 | Brief definition of the term | |
| 19 | Explain the math Quick Action | T7-6 | Restates the equation in LaTeX, typeset, then explains | |
| 20 | Typed Inline Question | T7-7, T7-8 | Typed question answered; keys stay in the field | |
| 21 | Continue in Pane link | T10-1, T10-2 | Link only under a finished Answer; click reveals the Claude section | |
| 22 | Continue in Pane carries the exchange | T10-2 to T10-9, T10-11 | Imported turn present; Claude remembers it (resume or quoted context) | |
| 23 | No button for EPUB and snapshots | T7-2 | No Ask Claude button in either popup | |
| 24 | Item title, authors, year, abstract in every question | T7-7, C-CTX1 | Answer names the paper's title (and authors/year when asked) | |
| 25 | Selection text sent | T7-4, T7-5 | Answer is about the highlighted passage | |
| 26 | Picture of the highlighted region | T8-13, T8-14, T8-17 | Equation transcribed as typeset LaTeX; crop covers first page only; orientation correct | |
| 27 | No whole-paper read for a quick definition | T8-4 | Fast answer, no Read in the CLI log | |
| 28 | Claude decides whether to read the PDF | T8-7 | Record whether it reads; reading not required | |
| 29 | "Use full paper" toggle | T8-1, T8-2, T8-3, T8-6, T8-8 | Checkbox in pane and card, per pane, never saved; forces a Read | |
| 30 | Force phrases | T8-5, C-CTX1 | "use the paper", "READ THE PAPER", "add context", "use full paper" each trigger a Read | |
| 31 | Claude reads the PDF itself | T8-5, T8-6, T8-18 | Read of the PDF path in the log; `--tools Read` form of command line | |
| 32 | Fallback to extracted text or text only | T8-11, T8-12, T8-16 | Answer arrives without error from extracted text, Item Context or text only | |
| 33 | Streaming Answers | T4-4, T7-4 | Text arrives incrementally | |
| 34 | Markdown rendering | T6-1, T6-3 | Heading, list, table, code block render in pane and card | |
| 35 | Math rendering | T6-2, T6-3, T6-7, T7-6 | KaTeX typeset in light and dark; bad math does not break the Answer | |
| 36 | Stop button | T7-10, T4-c | Stop cancels the run; button returns to Send | |
| 37 | Stop keeps the partial Answer | T7-10, T4-c | Partial text stays, followed by "Stopped." | |
| 38 | Model picker | T7-9, T4-b | Picked model is used (`--model`) in pane and card | |
| 39 | Picker defaults to preferred model | T7-3, T4-b, C-PR3 | New pane/card starts at the Settings default | |
| 40 | Save as note under each Answer | T9-4, T9-12, T9-13 | One child note per press (standalone note for a parentless PDF) | |
| 41 | Save Thread as note | T9-7, T9-7b, T9-8, T9-9 | One note with every finished and stopped turn in order | |
| 42 | Notes are child notes with Zotero math | T9-4, T9-5, T9-6 | Math editable in the note editor; prices and code stay text | |
| 43 | Save as annotation | T9-10, T9-14, T9-15 | Card button saves once | |
| 44 | Annotation is a highlight with Q&A comment | T9-10, T9-11 | Highlight over the Selection; comment `Q: ...` plus Answer; right page label | |
| 45 | Nothing written without a press | T9-1, T9-2, T9-3, T9-17 | Note and annotation counts unchanged | |
| 46 | Claude preferences pane | C-PR1 | Settings → Claude pane with three groups | |
| 47 | CLI path auto-detect and override | C-PR2, C-CLI1, T4-54, T4-X2 | Detected path shown; override used; missing path gives the plain message | |
| 48 | Default model preference | C-PR3 | New panes and cards start at the chosen model | |
| 49 | About me text | C-PR4 | Instruction in About me shows in the Answers | |
| 50 | Answer language | C-PR5 | Language follows the field; empty matches the question | |
| 51 | Uses the local Claude Code login | T4-51 | Answer arrives with no API key | |
| 52 | Isolated from user's Claude Code setup | T4-52, T4-X1 | No connectors, hooks or skills; isolation flags on the command line | |
| 53 | No tools except reading the one PDF | T4-53, T8-9, T8-10 | No tools without Paper Context; only the allowed PDF readable | |
| 54 | CLI missing message | T4-54, T7-21, C-ERR1 | "Claude Code CLI not found. ..." | |
| 55 | Signed-out message | T4-55, C-ERR1 | "Claude Code is not signed in. ..." | |
| 56 | Usage-limit message | T4-56 | Message shown if a limit is hit (see notes below) | |
| 57 | No automatic retries | T4-57, C-ERR2 | One error, one spawn | |
| 58 | No orphaned processes | T4-58, T7-10, T7-16, T7-17, T7-22, L-3, L-6, L-7 | `claude.exe` gone within seconds after Clear, close, disable, quit | |
| 59 | Clean disable and uninstall without restart | L-1 to L-5, T4-X8, T6-8, T7-22 | Button, pane and preferences go and return, no console errors | |

Notes on the table:
- **Story 56** can only be checked by hand if you actually hit a usage limit. If you cannot, mark it "not run" and cite the unit tests: `tests/unit/failure.test.ts` pins the pattern-to-message mapping (`rate limit`, `usage limit`, `429`) and `tests/unit/runner.test.ts` the `rate-limited` event. The t4 file already says these patterns are unverified against a real limit.
- **Story 57** also rests on `tests/unit/runner.test.ts` and `tests/unit/ask-controller.test.ts`; the manual step confirms it in the real process list.
- Rules pinned by vitest and also checked by hand above: Thread keying (`thread-store.test.ts`), Context Builder modes and force phrases (`context-builder*.test.ts`), prior context and resume (`thread-store-import.test.ts`, `ask-controller-prior.test.ts`, `continue-in-pane.test.ts`), Answer Renderer (`answer-renderer-*.test.ts`, `safe-html.test.ts`, `safe-link.test.ts`), CLI arguments (`cli-invocation*.test.ts`, `process-args.test.ts`, `read-denials.test.ts`), saving (`saving.test.ts`, `save-button.test.ts`), preferences (`prefs*.test.ts`), lifecycle wiring (`lifecycle.test.ts`).

## 3. Steps

Run the groups in this order. Where a group says "run rows", run each row of that file exactly as written, including its Expected column, and every "Not verifiable statically (watch for these)" item of that file, recording what you saw. No Expected result or watch item of the per-ticket files is dropped.

### 3.1 Claude Pane (stories 1 to 11, 33)

Preparation: the t4 file's preparation (regular item with a PDF child, a second item, a standalone PDF, a note).

Run rows: **T4-1 to T4-11, T4-6b, T4-6c, T4-a, T4-b, T4-c**, and from the t4 table of checks that could not be made without running Zotero: **T4-X3 (UTF-8 streaming), T4-X4 (Fluent strings), T4-X5 (icons in light and dark), T4-X6 (working directory)**. T4-X1, X2 and X7 are run in 3.8; T4-X8 in section 4.

Watch for: the library and reader panes streaming the same text without duplication (T4-4); keys typed in the input never triggering Zotero shortcuts (T4-7); a second main window showing the same header and tooltip (T4-X4).

### 3.2 Preferences (stories 46 to 50, 39)

No per-ticket file covers these, so these steps are new.

| # | Step | Expected |
|---|------|----------|
| C-PR1 | Open Settings (Edit → Settings). Look in the left list. | A **Claude** pane exists. It has three groups: **Claude CLI** (path field and a status line), **Answers** (Default model menu with Haiku, Sonnet, Opus; Answer language field with the placeholder "Match the question") and **About me** (text area). (Story 46) |
| C-PR2 | Open the Claude pane with the CLI path empty. Then type a valid full path to your `claude.exe` and press Tab. Then type `C:\nope\claude.exe`. Reopen the pane after each. | Empty: the status line says "Using the auto-detected path: <path>" (or "Claude CLI not found. Install Claude Code or enter its path above." if undetected). Valid path: "Using the path above. Auto-detected: ...", and a question works. Missing path: a question gives the "CLI not found" message (T4-54). Each value persists after closing and reopening Settings. Clear the field afterwards. (Story 47) |
| C-PR3 | Set Default model to **Haiku**. Open a new reader tab and a new card. Ask in each. Set it back to Sonnet. | The pane's and card's model picker start on Haiku, and the command line has `--model haiku`. After restoring, new panes start on Sonnet. (Stories 38, 39, 48) |
| C-PR4 | Put "Always end every answer with the single word KIWI." in About me. Ask a question in the pane and in a card. Clear the field and ask again. | The Answers end with KIWI; without the text they do not. The text persists after closing Settings. (Story 49) |
| C-PR5 | Set Answer language to `French` and ask an English question in the pane. Then empty the field and ask a question in German or Spanish. | French Answer. With an empty field the Answer follows the question's language, and the field shows its placeholder after reopening Settings (the pref stores `match`). (Story 50) |
| C-PR6 | Restart the test Zotero. Open Settings → Claude. | The CLI path, model, language and About me values you left are still there (preferences persist; Threads do not). |

### 3.3 Answers: Markdown and math (stories 33 to 35)

Preparation: the t6 file's preparation.

Run rows: **T6-1 to T6-9** (T6-8 disables the plugin; run it with section 4 if you prefer, and record it in either place). Watch for: KaTeX fonts, not a fallback serif (T6-2); no flicker while a formula streams (T6-3); the selection in an earlier Answer surviving a new stream (T6-4); no alert from the hostile content (T6-6).

### 3.4 Inline Card and Quick Actions (stories 12 to 20, 23, 33 to 39)

Preparation: the t7 file's preparation (PDF with abstract, two pages and an equation; second PDF; EPUB; snapshot).

Run rows: **T7-1 to T7-23**. Watch for the five items in the t7 "Not verifiable statically" section: the popup staying open under the card, Tab inside the card (record; known limitation), the anchoring fallback in Reading Mode, KaTeX fonts via `chrome://claudeforzotero-katex/content/`, and zoom with no scroll change at the top of page 1 (T7-12). T7-22 is the disable test; L-3 repeats it.

### 3.5 Paper Context and the Selection picture (stories 24 to 32, 53)

Preparation: the t8 file's preparation (items A to E, secret file, Process Explorer, session log).

Run rows: **T8-1 to T8-18**, plus:

| # | Step | Expected |
|---|------|----------|
| C-CTX1 | In item A's pane, with Use full paper unchecked, ask four questions in turn: "add context: what is the title of section 3?", "use full paper: list the section headings", "Read the paper and name its last section", and "What is the abstract about?" (no phrase). Check the CLI log after each. Once, also ask "Which paper is this and who wrote it?". | The first three each show a Read of A's PDF in the log (phrases are case-insensitive: "add context", "use the paper", "use full paper", "read the paper"). The fourth shows none. The last Answer names the title, authors and year, so Item Context is sent. (Stories 24, 30) |

Watch for the t8 items: the reader tab's PDF lookup (run T8-6 in both the library and a reader tab), which attachment counts as the item's PDF, the extracted-text wait on an unindexed PDF, a Read denied at runtime, and Space on the card's checkbox.

### 3.6 Saving (stories 40 to 45)

Preparation: the t9 file's preparation. Note the child note and annotation counts of item A first.

Run rows: **T9-1 to T9-17, including T9-7b**. Do T9-1 to T9-3 first and T9-17 last. Afterwards delete the test notes and annotations by hand. Watch for the t9 items: note math markup, display math in the middle of a paragraph, the annotation copy across the compartment wrapper, highlight colour, and the comment staying plain text.

### 3.7 Continue in Pane (stories 21, 22)

Preparation: the t10 file's preparation.

Run rows: **T10-1 to T10-12** (T10-12 is optional). Watch for the t10 items: the reveal mechanics, the section id (`<pluginID>-claude`), the expand-from-collapsed jump, and importing while the pane is answering.

### 3.8 Errors, privacy and CLI discovery (stories 47, 51 to 58)

Run rows: **T4-51 to T4-58** and the t4 checks **T4-X1 (empty-value arguments in the command line)** and **T4-X2 (PATH inside Zotero: start Zotero from the Start menu, clear the CLI path, ask)**. T4-X7 (large stderr) has no manual step; `tests/unit/subprocess-port.test.ts` pins it. Also:

| # | Step | Expected |
|---|------|----------|
| C-CLI1 | With the override empty, hide `~/.local/bin/claude.exe` (rename it) only if it is the detected path and PATH has no other `claude`; otherwise skip and write why. Ask. Restore the file. | The "CLI not found" message appears and the status line in Settings → Claude says "Claude CLI not found. ...". Restoring the file makes the next question work without a restart. (Story 47) |
| C-ERR1 | Trigger each error (T4-54, T4-55, and T7-21 in a card) and read the message in the pane and in the card. | The same plain-language text in both places, in red in the card, with the fix; no stack trace. (Stories 54, 55) |
| C-ERR2 | Ask a normal question after each error. | It works; the failed turn stays in the Thread as a failed turn and nothing retries. (Story 57) |

## 4. Lifecycle check (ticket acceptance criterion)

Use a Thread with at least one finished Answer, a library item selected and a reader tab open on a PDF. Enable Debug Output Logging and clear the Error Console first. Record `tasklist /FI "IMAGENAME eq claude.exe"` (or the PowerShell line from section 1) before each step.

| # | Step | Expected |
|---|------|----------|
| L-1 | Tools → Plugins → Claude for Zotero → **Disable**, without restarting Zotero. Look at the library item pane, a reader tab's context pane and sidenav, a PDF selection popup, and Edit → Settings (reopen Settings if it was open). | The Claude section and sidenav button are gone from the item pane and the reader's context pane. Selecting text shows no **Ask Claude** button. The **Claude** pane is gone from Settings. Answer and KaTeX styles are gone (T6-8). No error mentioning Claude in the Error Console or Debug Output. (Story 59) |
| L-2 | Tools → Plugins → **Enable**, again without restarting. Check the same places. | The Claude section and sidenav button are back in the library and in the reader tab, with header and tooltip **Claude** (not empty, not a raw message ID; T4-X4). **Ask Claude** is back in a PDF's popup. The **Claude** preferences pane is back with the values you set earlier. Answers are styled with typeset math again. The Thread was cleared by the disable (the Thread Store is in memory); a new question works. No console errors. (Story 59) |
| L-3 | Disable while an Answer streams in the pane, and again while a card Answer streams; re-enable afterwards. | The Answer stops, the card disappears, and the plugin's `claude.exe` is gone from Task Manager within a few seconds (compare with the baseline; plugin runs carry `--strict-mcp-config`). No late text, no console errors. (Stories 58, 59) |
| L-4 | Disable and enable three times in a row, then ask a question in the pane and in a card. | Exactly one Claude section, one sidenav button and one Ask Claude button each time (no duplicates), and both questions work. The Error Console shows no errors. |
| L-5 | Disable the plugin, then Remove it in Tools → Plugins (uninstall). Check section, button and preferences pane. Reinstall the .xpi afterwards. | Everything is gone without a restart, with no console errors; the reinstall restores everything. (Story 59) |
| L-6 | **Quit Zotero mid-answer.** Start a long Answer in the pane ("Explain in detail, with ten sections") and, if you can, a card Answer too. While they stream, quit Zotero (File → Quit). Within 10 seconds run `tasklist /FI "IMAGENAME eq claude.exe"`. | Zotero exits. No plugin `claude.exe` remains (compare with the baseline). If one remains, note its command line and how long it lived; that is a fail of story 58. Restart Zotero: no Threads (T4-10), no crash dialog. |
| L-7 | Close a reader tab mid-answer, press Clear mid-answer, and press ✕ mid-answer, with the process list open. | Each time that run's `claude.exe` exits within a few seconds (T4-11, T7-16 and T7-17 cover each; repeat once here). |

## 5. Results

Fill this in by hand after the run.

- **Date:**
- **Zotero version:** (expect 10.0.8)
- **OS:**
- **Claude Code CLI version:** (`claude --version`)
- **Plugin version / commit:**
- **Test profile and data directory (path):**
- **Tester initials:**
- **`npm test` and `npm run build` results:**

Failures (one line each: story or step, what happened, issue link):

1.
2.
3.

Steps not run, and why:

Notes:

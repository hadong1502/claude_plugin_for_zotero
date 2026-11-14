# Spike notes: popup focus, CLI discovery, scoped Read, image input, latency (#3)

Spec #1, "Spike first". Environment: Zotero 10.0.8 at `C:\Program Files\Zotero`, Claude Code CLI 2.1.322 at `C:\Users\USER\.local\bin\claude.exe`, Windows 11, recorded 2026-11-14. Paths are redacted to `C:\Users\USER`. The spike scratch folder is shortened to `C:\Users\USER\AppData\Local\Temp\claude-spike` (`<spike>` below), and the CLI's working directory was `<spike>\work` for every run.

Marks:
- **VERIFIED** means observed in a real CLI run or read directly from the installed source, as stated.
- **SOURCE-VERIFIED** means read from the installed Zotero source but not exercised at runtime. Zotero was not launched.
- **UNVERIFIED** means inferred and not observed.

## Answers at a glance

| # | Question | Answer | Mark |
|---|---|---|---|
| 1 | Does focusing an input in the selection popup keep it open? | Yes. The reader's focus handler explicitly exempts `.selection-popup`, and nothing else listens for blur. Moot for the design, because the Inline Card is a separate element. | SOURCE-VERIFIED |
| 2 | Does Zotero's environment find `claude.exe` on PATH? | Yes. `C:\Users\USER\.local\bin` is on the **user** PATH (not the system PATH), and nothing earlier on PATH is named `claude`. The fallback `<home>\.local\bin\claude.exe` exists. | VERIFIED (registry and files); Zotero process env UNVERIFIED |
| 3 | Flags that let Read open exactly one PDF? | `--tools Read --permission-mode dontAsk --settings '{"permissions":{"allow":["Read(<pdf rule>)"],"deny":["Read(<workdir rule>/**)"]}}'`. The workdir deny is required because files in the cwd are readable without any rule. | VERIFIED |
| 4 | Can an image go through `--input-format stream-json` as base64? | Yes. An `image` content block with `source.type: "base64"` works. No temporary PNG is needed. | VERIFIED |
| 5 | Quick Action latency (clean env, median of 3) | Haiku: 5.6 s wall, 3.9 s to first text. Sonnet: 6.2 s wall, 3.4 s to first text. About 2.1–2.3 s of each is CLI startup before `init`. | VERIFIED |

## 1. Popup focus: SOURCE-VERIFIED (not runtime-verified)

**Answer.** An `<input type="text">` appended to the selection popup through `renderTextSelectionPopup` would keep the popup open when the user clicks into it and types, as long as the PDF selection doesn't change. This only matters for the Ask Claude Button. The Inline Card is a separate fixed-position element, and only the button lives in the popup, so the result doesn't change the design.

**Evidence.** The source is `resource/reader/reader.js` from `C:\Program Files\Zotero\app\omni.ja`, extracted with `unzip -p "C:/Program Files/Zotero/app/omni.ja" resource/reader/reader.js`. The file has 85,857 lines, and the line numbers below refer to it.

- **The popup only closes when the PDF selection changes.** The popup state is cleared only by `_onSetSelectionPopup()` with no argument in the PDF view, in these places:
  - `_setSelectionRanges()` with empty or collapsed ranges (L76759–76771);
  - pointer-down on empty page space (L77735);
  - dragging (L78231);
  - creating a highlight with a tool (L78453);
  - `clearSelection()` (L76095), which runs on Escape in the PDF iframe (L79088–79095) and on the Ctrl-Alt-Digit shortcuts (L79000, L79007);
  - `setSelectedAnnotationIDs()` (L76733–76739).
- **The popup component closes nothing itself.** `ViewPopup` (L30747–30904) and `SelectionPopup` (L30947–31007) have no blur, focus-out or outside-click handler; they only position themselves. (By contrast, `ReadAloudAnnotationPopup`, L39044 onward, does dismiss itself on window blur and outside pointer-down.)
- **Focus inside the popup is exempted.** `FocusManager` listens for `focusin` on the reader window (L81509). Its `_handleFocus` (L81577–81587) calls `_onDeselectAnnotations()` for any focused element **not** inside `.annotation, .annotation-popup, .selection-popup, .label-popup, .appearance-popup, .context-menu, iframe`. That call becomes `setSelectedAnnotations([])` (L83118), then `_updateState({selectedAnnotationIDs: []})`, then `view.setSelectedAnnotationIDs([])` (L83415–83418), then `_setSelectionRanges()`, which closes the popup and clears the text selection. Focus inside `.selection-popup` skips all of this.
- **Clicking the input focuses it.** `FocusManager._handlePointerDown` (L81588–81609) calls `preventDefault()` on pointer-down, which blocks focus, except on `input, textarea, select, [contenteditable="true"], ...`.
- **Typing in it is safe.** The PDF view's own key handler sits on the inner iframe window (L75542), so it doesn't see keys typed in the outer reader document. `KeyboardManager` skips its single-key shortcuts when `isTextBox(event.target)` is true (L81873, L82113). `isTextBox` matches `INPUT` with `type === 'text'` or `contenteditable="true"` (L31229–31231), but not `textarea`.
- **Plugin content is rebuilt on every new selection.** `CustomSections` (L29374–29408) is `React.memo`'d. Its effect calls `sectionRef.current.replaceChildren()` and re-dispatches `renderTextSelectionPopup` whenever the `annotation` prop changes, which happens on every new selection. `append` throws if called asynchronously. Anything typed into a popup input is lost when the selection changes.

**Consequence for the Inline Card (UI ticket).** The same `FocusManager` logic applies to the Inline Card if the card lives in the reader's outer document. Focusing the card's input (outside the exempt selectors) runs the deselect path, which clears the PDF text selection and closes the selection popup. The card must therefore capture the Selection (text, rects, page, the popup's `annotation`) when the button is pressed, as the spec already says, and must not rely on the selection staying visible. This is SOURCE-VERIFIED and should be checked during the manual in-Zotero walkthrough.

## 2. CLI discovery: VERIFIED for registry and files; UNVERIFIED inside a running Zotero

**Answer.** `Subprocess.pathSearch("claude")` should find `C:\Users\USER\.local\bin\claude.exe` in a Zotero started from the Start menu. That folder is on the **user** PATH, and Explorer passes the merged PATH (system first, then user) to programs it starts. The fallback `<home>\.local\bin\claude.exe` exists.

**Evidence.**
- `reg query "HKCU\Environment" /v Path`: the user PATH (`REG_EXPAND_SZ`) contains the literal entry `C:\Users\USER\.local\bin`, about two-thirds of the way along.
- `reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path`: the system PATH does **not** contain `.local\bin`.
- A scan of every entry of system PATH plus user PATH (74 entries) for a file named `claude` or `claude.*` found exactly one match, at entry 67, `C:\Users\USER\.local\bin\claude.exe`. No `claude.cmd` shim exists earlier, for example in the npm global folder.
- `ls -la C:/Users/USER/.local/bin/` shows `claude.exe` at 346,496,160 bytes, and `claude.exe --version` prints `2.1.322 (Claude Code)`.
- `PATHEXT` is `.COM;.EXE;.BAT;.CMD;...`.
- Gecko's Windows `pathSearch` (`modules/subprocess/subprocess_win.sys.mjs` L146–185, in `C:\Program Files\Zotero\omni.ja`) splits `PATH` on `;`. For each directory, in order, it tries the bare name and then each `PATHEXT` extension, and returns the first executable it finds. It throws `ERROR_BAD_EXECUTABLE` if nothing matches.
- The user PATH ends with `;`, which leaves an empty last entry. `.local\bin` comes before it, so the search returns before reaching it. Whether `PathUtils.join("", "claude")` would throw is not tested.

**Unverified.** Zotero's actual process environment wasn't inspected, since Zotero wasn't launched. A Zotero started from a shell gets that shell's PATH instead. The auto-detect order in the spec (pathSearch, then `<home>\.local\bin\claude.exe`, then the user's override) covers both cases.

## 3. Scoped Read: VERIFIED

**Answer.** These flags let Claude Read one absolute PDF path non-interactively while every other path is refused:

```
--tools Read
--permission-mode dontAsk
--settings '{"permissions":{"allow":["Read(<pdf rule>)"],"deny":["Read(<workdir rule>/**)"]}}'
```

They are used together with the isolation flags. `--setting-sources ""` doesn't block `--settings`.

**Building the rule path** from the absolute Windows path Zotero gives:
1. Use `//` followed by the drive letter in lower case and the rest of the path with forward slashes. `C:\Users\USER\Zotero\storage\ABCD1234\file.pdf` becomes `//c/Users/USER/Zotero/storage/ABCD1234/file.pdf`.
2. Backslash-escape the glob metacharacters `[`, `]`, `{` and `}`. `*` and `?` can't appear in Windows file names.

**What was tested.**
- Characters that need **no** escaping (VERIFIED): space, `(`, `)`, `,`, `-`, `#`, `&`.
- Characters that **need** escaping (VERIFIED): unescaped `[2024] {v2}` doesn't match, and the backslash-escaped form does.
- UNVERIFIED: other characters such as `!`, `+`, `@`, `'`, non-ASCII names, upper-case drive letters, other drives, and UNC paths.

**Why the workdir deny is needed.** Without any rule, Read of a file **inside the working directory** is allowed even in `dontAsk` mode. Run 3 below shows it. The deny rule on `<workdir>/**` closes that hole, and run 4 shows it working. The plugin's working directory should also stay empty.

**Why `--settings` and not `--allowedTools`.** `--allowedTools` is a "comma or space-separated list" (from `claude --help`). A rule whose path contains a space or comma, like `Read(.../Test Paper (2024) - Smith, Lee.pdf)`, was split, so the file was **denied** (run 3). The same rule passed as JSON through `--settings` worked (run 4). An `--allowedTools` rule does work for a path without spaces or commas (run 2).

**Reading a PDF with an equation works under the isolation flags.** The Read `tool_result` carries a `document` block (`media_type: application/pdf`). The model returned the marker word `MAGENTA-41` and equation (1) as `\mathcal{Z}(\beta) = \sum_{k=0}^{\infty} \frac{(-1)^k \, \beta^{2k}}{(2k)!} \, e^{-\lambda_k \beta}`, which matches the source exactly (runs 2, 4, 18).

**Runs.** All used haiku, cwd `<spike>\work`, the isolation flags and `--input-format stream-json`.

| Run | Allow mechanism | Files asked for | Outcome |
|---|---|---|---|
| 2 | `--allowedTools "Read(//c/.../files/paper.pdf)"` | `paper.pdf`, `secret.txt` | PDF read; `secret.txt` denied (`decision_reason_type: "mode"`), listed in `permission_denials` |
| 3 | `--allowedTools "Read(//c/.../files/Test Paper (2024) - Smith, Lee.pdf)"` | that PDF, `work\inside.txt` | PDF **denied** (rule split on space/comma); `inside.txt` (in cwd, no rule) **read**: `TEAL-12` |
| 4 | `--settings` allow `Test Paper (2024) - Smith, Lee.pdf`, deny `work/**` | same | PDF read; `inside.txt` denied: `File is in a directory that is denied by your permission settings.` |
| 5 | `--settings` allow `Smith [2024] {v2} #1 & co.pdf`, unescaped | that PDF | denied (glob mismatch) |
| 6 | (invalid: a quoting bug left the settings empty) | | not counted as evidence |
| 7 | `--settings` allow `Smith \[2024\] \{v2\} #1 & co.pdf`, escaped | that PDF | read; `permission_denials: []` |
| 18 | **decided flags:** `--settings` allow `paper.pdf`, deny `work/**` | `paper.pdf`, `secret.txt` | PDF read; `secret.txt` denied. Fixture `read-allowed-and-denied.jsonl` |

Excerpt from run 18 (trimmed):

```
{"type":"system","subtype":"init",...,"tools":["Read"],"mcp_servers":[],"permissionMode":"dontAsk",...}
{"type":"assistant",...,"content":[{"type":"tool_use","name":"Read","input":{"file_path":"C:\\Users\\USER\\...\\files\\paper.pdf"}}]}
{"type":"user",...,"content":[{"type":"tool_result","content":[{"type":"text","text":"PDF file read: ...paper.pdf (86KB)"},{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"<elided>"}}]}]}
{"type":"assistant",...,"content":[{"type":"tool_use","name":"Read","input":{"file_path":"C:\\Users\\USER\\...\\files\\secret.txt"}}]}
{"type":"system","subtype":"permission_denied","tool_name":"Read","decision_reason_type":"mode","message":"Permission to use Read has been denied because Claude Code is running in don't ask mode. ..."}
{"type":"user",...,"content":[{"type":"tool_result","content":"Permission to use Read has been denied ...","is_error":true}]}
{"type":"result","subtype":"success","is_error":false,"result":"**PDF (`paper.pdf`):** The Read succeeded. ... MAGENTA-41 ...","permission_denials":[{"tool_name":"Read","tool_input":{"file_path":"...\\secret.txt"}}]}
{"type":"system","subtype":"task_summary",...}
```

**Notes for the Runner.**
- If `result.permission_denials` contains the allowlisted PDF path itself, the rule didn't match, for example because of an untested character. The Runner can surface that or fall back to extracted text.
- The model may read large PDFs in page ranges. Each range is another Read of the same allowed path, so that's fine (UNVERIFIED for PDFs over 10 pages).

## 4. Image input: VERIFIED (base64 via stream-json works; no fallback needed)

**Answer.** Yes. The stdin message is one line, and stdin is closed after it:

```json
{"type":"user","message":{"role":"user","content":[
  {"type":"text","text":"Transcribe the equations in the attached picture as LaTeX, then name the two laws in one short sentence."},
  {"type":"image","source":{"type":"base64","media_type":"image/png","data":"iVBORw0KGgo..."}}]}}
```

The command was:

```
claude.exe -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages
  --strict-mcp-config --setting-sources "" --system-prompt "<SP>" --tools "" --model haiku  < image.jsonl
```

The test image was a 6.9 KB PNG at 200 dpi of $\nabla \cdot \mathbf{E} = \rho/\varepsilon_0, \oint_{\partial\Sigma} \mathbf{B}\cdot d\boldsymbol{\ell} = \mu_0 I_{\mathrm{enc}}$, typeset with pdflatex and rendered with pdftoppm. The answer (exit 0, 7.2 s wall) was:

```
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}, \qquad \oint_{\partial \Sigma} \mathbf{B} \cdot d\boldsymbol{\ell} = \mu_0 I_{\text{enc}}
These are Gauss's law for electricity (differential form) and Ampère's law (without Maxwell's displacement-current term).
```

That is a character-exact transcription. The fixture is `image-input.jsonl`. `ContentBlock` `{type:'image', mediaType:'image/png', data}` in `src/core/types.ts` maps one-to-one to this block.

**Fallback (not needed, UNVERIFIED).** The fallback would write the PNG to a temporary file outside the workdir and add a second `allow` rule `Read(<png rule>)`. It uses the same mechanism as question 3, which is verified for PDFs. Not tested with a PNG.

**Also UNVERIFIED:** an image combined with `--resume`, and an image combined with `--tools Read`. Neither was run. Both are independent of the input format.

**Consequence.** Use `--input-format stream-json` for **every** run, with or without an image, so the prompt always takes the same path. Text-only stream-json input is verified by the latency, resume and Read runs. The Runner must close stdin after writing the one message line.

## 5. Latency: VERIFIED

**Setup.** Each run was a Quick Action-sized question (Q-define in `tests/fixtures/cli/README.md`: item line, selection line, one-sentence instruction, about 1k input tokens with SP-A). Flags were the isolation flags with `--input-format stream-json --tools ""`. The CLI was spawned by a Node harness, and times were measured from spawn. "Clean env" means all `CLAUDE*`, `ANTHROPIC*`, `MCP_*` and `OTEL*` variables were removed, which is what Zotero from the Start menu would have.

Clean env, 3 runs each (ms):

| Model | wall (exit) | to `system/init` | to first `text_delta` | to `result` | `duration_ms` | `duration_api_ms` |
|---|---|---|---|---|---|---|
| haiku (`claude-haiku-5-5`) | 5096, 7092, 5610 → **median 5610** | median 2090 | 3783, 5773, 3929 → **median 3929** | median 4838 | median 3146 | median 2671 |
| sonnet (`claude-sonnet-5-5`) | 6239, 7682, 5785 → **median 6239** | median 2268 | 3438, 5165, 3288 → **median 3438** | median 5145 | median 3464 | median 2772 |

Inherited env from the host Claude Code session (`CLAUDE_EFFORT=high` among others), 3 runs each, for comparison:

| Model | wall median | first text median | to result median |
|---|---|---|---|
| haiku | 7423 | 3974 | 6624 |
| sonnet | 7172 | 3180 | 6591 |

Observations:
- **Fixed overhead.** About 2.1–2.3 s passes before `system/init` (CLI boot). The process also exits about 0.6–0.8 s after `result`. The Runner should emit `done` on the `result` event, not on process exit.
- **Haiku thinks by default.** Haiku 5.5 emitted a thinking block (358–637 output tokens) before the text on every run. Sonnet did not think on this question (197–246 output tokens). As a result, Sonnet reached first text sooner than Haiku, and the two had similar total time.
- **Effort setting.** An inherited `CLAUDE_EFFORT=high` slowed Haiku by about 1.8 s. The Runner should pass a clean environment, or set effort explicitly, so that a Zotero launched from a Claude Code terminal (for example `npm start`) behaves like the installed one. `--effort low` for Quick Actions was not measured.
- **Resume.** A resumed follow-up was faster: Sonnet 4.7 s wall, 3.3 s to first text (`clean-resume-sonnet`).
- **No caching across runs.** `cache_creation_input_tokens` was about 1000 and `cache_read_input_tokens` was 0 on every first turn.

## Stream-json facts for the Runner (from these transcripts)

- **Text.** Take text only from `stream_event` where `event.type == "content_block_delta"` and `event.delta.type == "text_delta"`. Ignore `thinking_delta`, `signature_delta` and `input_json_delta`.
- **Unknown events.** Event types seen that the research didn't list:
  - `system/status`
  - `system/thinking_tokens`
  - `system/post_turn_summary`
  - `system/task_summary`, which can come **after** `result`
  - `system/permission_denied`
  - `user` events carrying `tool_result`
  The parser must ignore them and keep reading until EOF.
- **Session id.** It comes from `system/init` and `result`, and a resume keeps it unchanged. A failed resume has no `init` at all.
- **Errors.** Use `result.is_error`, never `subtype`: API-level errors arrive as `subtype: "success"` with `is_error: true`. Observed patterns:

  | Kind | `assistant.error` | `result` | stderr | exit |
  |---|---|---|---|---|
  | not signed in (simulated with an empty `CLAUDE_CONFIG_DIR`) | `authentication_failed` | `is_error: true`, `result: "Not logged in · Please run /login"` | empty | 1 |
  | unknown model | `model_not_found`, `api_error_status: 404` | `is_error: true`, text "There's an issue with the selected model (...)" | `[claude-code:unrecognized_model] {...}` | 1 |
  | unknown resume id | (no assistant) | `subtype: "error_during_execution"`, `errors: ["No conversation found with session ID: ..."]` | same text | 1 |
  | rate limited | **UNVERIFIED**, not observed | — | — | — |

  Map `authentication_failed` and the "Not logged in" text to `not-signed-in`. A real expired or revoked login may word this differently (UNVERIFIED). For rate limits, the only observed signal is `rate_limit_event.rate_limit_info.status`, always `"allowed"` here. It also carries `rateLimitType`, `resetsAt`, `overageStatus` and `unifiedWindows`. The Runner ticket should treat a status other than `"allowed"`, an `assistant.error` such as `rate_limit`, and stderr containing "rate limit" or "usage limit" as `rate-limited`, all marked UNVERIFIED.
- **Answers with tool calls.** With tools, one run holds several assistant messages. `result.result` holds only the final message's text. In the recorded Read runs the model wrote no text before its tool calls, but it could.
- **What `init` still lists.** `init` lists built-in `skills`, `slash_commands`, `agents` and `plugins` (`cc-plugin-*@builtin`) even under isolation. With `--tools ""` or `--tools Read`, none can be invoked, and `tools` is `[]` or `["Read"]`. It also lists `memory_paths.auto` under `~\.claude\projects\<cwd-slug>\memory\`.

## Side effects of the spike

- 25 CLI runs, including one invalid run caused by a quoting bug.
- One new folder under `C:\Users\USER\.claude\projects\`: `C--Users-USER-AppData-Local-Temp-claude-9428e1f44e4a5eee-5a9f42d2-7aa6-470b-a512-c1372be8eac9-scratchpad-spike3-work`, with 21 entries. It was not deleted.
- The not-signed-in run wrote only into its own empty `CLAUDE_CONFIG_DIR` in the scratch folder.
- `~/.claude` settings were not touched.
- Throwaway scripts and test files (PDFs, PNG, harness) stayed in the session scratchpad, off the branch.

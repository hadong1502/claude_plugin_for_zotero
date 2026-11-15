# Answers come from the local Claude Code CLI, run isolated

The plugin gets every Answer by spawning the locally installed Claude Code CLI (`claude -p` with stream-json output) rather than calling the Anthropic API. This lets the user rely on their existing Claude subscription login, with no API key and no separate billing. The price is a few seconds of process startup per question and a dependency on the CLI's flags and output format.

Every run is isolated: `--strict-mcp-config` and `--setting-sources ""` with the plugin's own `--system-prompt`, no tools except Read restricted to the one PDF a question is about, and a fixed working directory in the plugin's data folder. Without isolation, the CLI loads the user's claude.ai connectors (Gmail, Outlook and others), hooks, settings and CLAUDE.md. That gave a Zotero question access to email, and it cost about 86k input tokens instead of about 1k. `--bare` is never used because it disables subscription login.

## Decided invocation (spike #3, CLI 2.1.322)

Evidence for everything in this section is in `docs/spike/iss-1-spike-notes.md`, and recorded transcripts are in `tests/fixtures/cli/`.

Every run:

```
claude.exe -p --input-format stream-json --output-format stream-json --verbose
  --include-partial-messages --strict-mcp-config --setting-sources ""
  --system-prompt <plugin prompt> --model <haiku|sonnet|opus>
  [--resume <session_id>]
  <tool flags>
```

**Tool flags when no file is readable:** `--tools ""`.

**Empty values on the command line:** Firefox's Subprocess on Windows drops an empty argument when it builds the command line, so `--setting-sources ""` would arrive as `--setting-sources --system-prompt`. The process adapter therefore sends each option with an empty value as `--setting-sources=` and `--tools=`, which the CLI parses as the same empty value (checked with CLI 2.1.322).

**Tool flags when one file is readable (Paper Context):**

```
--tools Read --permission-mode dontAsk
--settings {"permissions":{"allow":["Read(<file rule>)"],"deny":["Read(<workdir rule>/**)"]}}
```

- `dontAsk` refuses every tool call that isn't pre-allowed, with no prompt.
- Rules go through `--settings` as inline JSON, not `--allowedTools`. `--allowedTools` splits its value on spaces and commas, which breaks paths such as `Smith, Lee (2024).pdf`. `--settings` is still honoured under `--setting-sources ""`.
- The deny rule on the working directory is required. The CLI lets Read open files inside its cwd without any rule, even in `dontAsk` mode. The working directory must also stay empty.
- A rule path is the absolute Windows path rewritten as `//` + lower-case drive letter + the rest with forward slashes, with `[ ] { }` backslash-escaped because rules are globs. For example, `C:\Users\u\Zotero\storage\K\a [1].pdf` becomes `//c/Users/u/Zotero/storage/K/a \[1\].pdf`.
  - Verified: spaces, `( ) , - # &` without escaping, and `[ ] { }` with escaping.
  - Unverified: other characters, non-ASCII names, other drives and UNC paths.
  - If `result.permission_denials` lists the allowed file itself, the rule failed to match, and the plugin falls back to extracted text.

**Two readable files (#11 manual run, amending #8):** Paper Context allows up to two Read rules, one per file: the paper's text file (the attachment's extracted text, written by the plugin to `<Zotero data dir>/claude-for-zotero/paper-text/<attachment key>.txt`) and the PDF. The `allow` list has one rule per readable file; the `deny` rule on the working directory is unchanged.
- Why: for PDFs over 10 pages the CLI's Read needs page ranges, which it renders with `pdftoppm -jpeg` from PATH. Without poppler it fails (`pdftoppm is not installed`), and with TeX Live's `pdftoppm`, which has no JPEG support, CLI 2.1.325 misreports the failure as "PDF is password-protected". Text files need no external tool, so the text file makes Paper Context work on any machine, and the PDF stays readable for equations, figures and tables wherever poppler works.
- Rejected: text file only (loses typeset equations and figures where poppler works); PDF only with a documented poppler requirement (most Windows users have none, and TeX Live users get a misleading error).

**Prompt delivery:** stdin, never arguments. One stream-json line, then stdin is closed:

```json
{"type":"user","message":{"role":"user","content":[ <blocks> ]}}
```

- A text `ContentBlock` is `{"type":"text","text":...}`.
- An image `ContentBlock` (the Selection's PNG) is `{"type":"image","source":{"type":"base64","media_type":"image/png","data":...}}`.

Images go inline this way. No temporary PNG file or extra Read rule is needed.

**Environment:** the plugin passes the process environment without the `CLAUDECODE`, `CLAUDE_CODE_*` and `CLAUDE_EFFORT` variables. A Zotero started from a Claude Code terminal during development otherwise inherits them, and `CLAUDE_EFFORT=high` made Haiku about 1.8 s slower.

**Reading the stream:**
- Text comes only from `text_delta` stream events.
- The Answer is done at the `result` event. The process exits about 0.7 s later, and a `system/task_summary` event may still follow.
- Errors come from `result.is_error`, never from `subtype`.

**Measured cost:** a Quick Action takes about 5.6 s (Haiku) or 6.2 s (Sonnet) end to end, with first text after about 3.9 s and 3.4 s respectively. About 2.2 s of that is CLI startup.

## Considered Options

- **Anthropic API key:** faster and simpler to call, but billed separately per token. It's left as a future backend behind the same Runner interface.
- **One long-lived CLI process per Thread:** lower latency after the first question, but needs lifecycle handling (idle timeouts, crashes, shutdown). It's deferred. The measured per-question startup of about 2.2 s is acceptable for now.
- **`--allowedTools "Read(<path>)"` for the PDF rule:** rejected because it splits paths on spaces and commas.
- **Temporary PNG plus a Read rule for images:** unnecessary, because base64 image blocks work through `--input-format stream-json`.

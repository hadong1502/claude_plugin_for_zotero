# Claude CLI stream-json fixtures

Real stdout transcripts from Claude Code CLI 2.1.322 on Windows 11, recorded during the spike (#3, spec #1) on 2026-11-14. The Claude Runner's tests replay them through a fake Process Port. Spike notes: `docs/spike/iss-1-spike-notes.md`.

## Conventions

- `<name>.jsonl` is the CLI's stdout, one JSON event per line, in the order received.
- `<name>.stderr.txt` is the CLI's stderr, recorded only for the error runs. stderr was empty in every successful run.
- Exit code: 0 for every successful run, 1 for every `error-*` run.
- Redactions. The event structure is unchanged; only these string values were rewritten:
  - The user's home folder became `C:\Users\USER`, and the long session scratch folder became `C:\Users\USER\AppData\Local\Temp\claude-spike`. The working directory of every run was `C:\Users\USER\AppData\Local\Temp\claude-spike\work`.
  - Base64 PDF bodies in `tool_result` content (`source.data`) and in `tool_use_result.file.base64` became `<elided: base64 PDF, N chars>`.
  - No email address or account name appears in the transcripts.
- Environment. Runs marked **clean** removed every `CLAUDE*`, `ANTHROPIC*`, `MCP_*` and `OTEL*` variable from the child's environment, which matches a Zotero launched from the Start menu. The other runs inherited the variables of the Claude Code session that ran the spike, which include `CLAUDE_EFFORT=high` and `CLAUDE_CODE_ENTRYPOINT=claude-desktop`. That changes thinking effort and the `startup_timing.entrypoint` field, not the event shapes.

## Common command

Every run used the binary `C:\Users\USER\.local\bin\claude.exe`, with the prompt sent on stdin as one stream-json user message and stdin then closed:

```
claude.exe -p --input-format stream-json --output-format stream-json --verbose
  --include-partial-messages --strict-mcp-config --setting-sources ""
  --system-prompt "<SP>" <per-run flags>  < message.jsonl
```

The stdin line has this shape:

```json
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"<question>"}]}}
```

There were two system prompts:
- SP-A: `You help a researcher read academic papers inside Zotero. Answer concisely in Markdown. Write math in LaTeX with $...$ for inline and $$...$$ for display.`
- SP-B: `You are a concise assistant inside a reference manager. Answer briefly.`

There were two questions:
- Q-define: `Paper: "A Tiny Test Paper" (2024), by A. Smith and B. Lee.\nSelected text (page 1): "Here λ_k are the eigenvalues of the operator H."\nDefine the term or notation in the selected text, like a dictionary entry, in two or three sentences.`
- Q-hi: `Say hi in three words.`

## Fixtures

| File | What it shows | Per-run flags and stdin | Env |
|---|---|---|---|
| `normal-answer.jsonl` | Plain streamed answer: `system/init`, `system/status`, `stream_event` text deltas, `assistant`, `rate_limit_event`, then `result/success`. | SP-A, `--tools "" --model sonnet`, Q-define | clean |
| `normal-answer-with-thinking.jsonl` | Haiku 5.5 thinks by default: `thinking_delta` and `signature_delta` blocks and `system/thinking_tokens` events come before the text block. The parser must ignore them. | SP-A, `--tools "" --model haiku`, Q-define | clean |
| `resumed-session.jsonl` | Follow-up resumed from `normal-answer.jsonl`. `session_id` stays `f61ad1cb-1c52-4f9c-a7eb-793b3dcb3c55` in `init` and `result`, and the answer refers to the earlier turn. | SP-A, `--tools "" --model sonnet --resume f61ad1cb-1c52-4f9c-a7eb-793b3dcb3c55`, stdin `Which symbol did you just define? Answer in one short sentence.` | clean |
| `read-allowed-and-denied.jsonl` | **The decided Read flags.** The first Read (the allowed PDF) returns a `document` block. The second Read (`secret.txt`) gets `system/permission_denied` (`decision_reason_type: "mode"`) and an error `tool_result`, and `result.permission_denials` lists it. Several assistant messages in one run, and a `system/task_summary` after `result`. | SP-A, `--model haiku --tools Read --permission-mode dontAsk --settings '{"permissions":{"allow":["Read(//c/Users/USER/AppData/Local/Temp/claude-spike/files/paper.pdf)"],"deny":["Read(//c/Users/USER/AppData/Local/Temp/claude-spike/work/**)"]}}'`, stdin asks to Read `...\files\paper.pdf` and then `...\files\secret.txt` | inherited |
| `read-denied-unescaped-glob.jsonl` | An allow rule for `Smith [2024] {v2} #1 & co.pdf`, with `[ ] { }` unescaped, does **not** match the file, so the only Read is denied. With the same characters backslash-escaped, the Read succeeded (spike notes, run 7). | SP-B, `--model haiku --tools Read --permission-mode dontAsk --settings '{"permissions":{"allow":["Read(//c/Users/USER/AppData/Local/Temp/claude-spike/files/Smith [2024] {v2} #1 & co.pdf)"],"deny":["Read(//c/Users/USER/AppData/Local/Temp/claude-spike/work/**)"]}}'`, stdin asks to Read that file | inherited |
| `image-input.jsonl` | A base64 PNG sent as an `image` content block in the stdin message. The answer transcribes the typeset equations (Gauss and Ampère) into LaTeX. | SP-B, `--tools "" --model haiku`. Stdin content is `[{"type":"text","text":"Transcribe the equations in the attached picture as LaTeX, then name the two laws in one short sentence."},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"<6.9 KB PNG>"}}]` | inherited |
| `error-model-not-found.jsonl` + `.stderr.txt` | Unknown model. A synthetic `assistant` message (`model: "<synthetic>"`, `error: "model_not_found"`, `api_error_status: 404`), then `result` with `subtype: "success"` but `is_error: true`. The stderr line begins `[claude-code:unrecognized_model]`. Exit 1. | SP-A, `--tools "" --model claude-nonexistent-9`, Q-hi | inherited |
| `error-resume-not-found.jsonl` + `.stderr.txt` | `--resume` with an unknown session id. There is no `init`: a single `result` with `subtype: "error_during_execution"`, `is_error: true` and `errors: ["No conversation found with session ID: ..."]`. stderr has the same text. Exit 1. | SP-A, `--tools "" --model haiku --resume 00000000-0000-4000-8000-000000000000`, Q-hi | inherited |
| `error-not-signed-in.jsonl` + `.stderr.txt` | No credentials. A synthetic `assistant` message with `error: "authentication_failed"`, then `result` with `subtype: "success"`, `is_error: true` and `result: "Not logged in · Please run /login"`. stderr is **empty**. Exit 1. | SP-A, `--tools "" --model haiku`, Q-hi, with `CLAUDE_CONFIG_DIR` pointed at an empty folder. This is a simulated signed-out state: the user was not signed out. | inherited, plus `CLAUDE_CONFIG_DIR` |

No rate-limited transcript exists. The spike could not trigger a rejection safely. Every `rate_limit_event` recorded has `rate_limit_info.status: "allowed"`.

Line endings: the CLI writes LF-terminated lines, and `tests/fixtures/cli/.gitattributes` (`* -text`) keeps these files byte-exact on Windows checkouts with `core.autocrlf=true`.

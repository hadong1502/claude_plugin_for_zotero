# Answers come from the local Claude Code CLI, run isolated

The plugin gets every Answer by spawning the locally installed Claude Code CLI (`claude -p` with stream-json output) rather than calling the Anthropic API. This lets the user rely on their existing Claude subscription login, with no API key and no separate billing. The price is a few seconds of process startup per question and a dependency on the CLI's flags and output format.

Every run is isolated: `--strict-mcp-config` and `--setting-sources ""` with the plugin's own `--system-prompt`, no tools except Read restricted to the one PDF a question is about, and a fixed working directory in the plugin's data folder. Without isolation, the CLI loads the user's claude.ai connectors (Gmail, Outlook and others), hooks, settings and CLAUDE.md. That gave a Zotero question access to email, and it cost about 86k input tokens instead of about 1k. `--bare` is never used because it disables subscription login.

## Considered Options

- **Anthropic API key:** faster and simpler to call, but billed separately per token. It's left as a future backend behind the same Runner interface.
- **One long-lived CLI process per Thread:** lower latency after the first question, but needs lifecycle handling (idle timeouts, crashes, shutdown). It's deferred until real latency is measured.

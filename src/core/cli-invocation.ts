// CLI invocation builders (#4): the arguments, the stdin message and the child
// environment of every Claude CLI run (#1 Implementation Decisions, Backend).
import type { ClaudeRequest, ContentBlock } from './types';

/** Arguments of one CLI run. The question never goes here: it goes to stdin. */
export function buildCliArgs(request: ClaudeRequest): string[] {
  if (request.readableFiles.length > 0) {
    // #8 replaces this with the Read tool flags.
    throw new Error('buildCliArgs: readable files land in #8');
  }
  return [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--strict-mcp-config',
    '--setting-sources',
    '',
    '--system-prompt',
    request.systemPrompt,
    '--model',
    request.model,
    ...(request.resumeSessionId ? ['--resume', request.resumeSessionId] : []),
    '--tools',
    '',
  ];
}

/** The one stream-json user line written to stdin, newline-terminated. */
export function buildStdinMessage(content: ContentBlock[]): string {
  const blocks = content.map((block) =>
    block.type === 'image'
      ? {
          type: 'image',
          source: { type: 'base64', media_type: block.mediaType, data: block.data },
        }
      : { type: 'text', text: block.text },
  );
  return JSON.stringify({ type: 'user', message: { role: 'user', content: blocks } }) + '\n';
}

/** The child environment: drops variables that would make the CLI behave as a nested session. */
export function childEnvironment(env: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key === 'CLAUDECODE' || key === 'CLAUDE_EFFORT' || key.startsWith('CLAUDE_CODE_')) continue;
    result[key] = value;
  }
  return result;
}

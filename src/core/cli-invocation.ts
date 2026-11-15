// CLI invocation builders (#4): the arguments, the stdin message and the child
// environment of every Claude CLI run (#1 Implementation Decisions, Backend).
import { readRulePath } from './paper-context';
import type { ClaudeRequest, ContentBlock } from './types';

/**
 * Arguments of one CLI run. The question never goes here: it goes to stdin.
 * With readable files the Read tool is scoped to exactly those files (the
 * paper's text file and/or its PDF), one allow rule each in order, and the
 * workdir is denied (#8, #11, #1 ADR claude-code-cli-backend).
 */
export function buildCliArgs(request: ClaudeRequest, options?: { workdir?: string }): string[] {
  const files = request.readableFiles;
  let toolFlags: string[] = ['--tools', ''];
  if (files.length > 0) {
    if (!options?.workdir) throw new Error('buildCliArgs: workdir is required with a readable file');
    const settings = {
      permissions: {
        allow: files.map((file) => `Read(${readRulePath(file)})`),
        deny: [`Read(${readRulePath(options.workdir)}/**)`],
      },
    };
    toolFlags = [
      '--tools',
      'Read',
      '--permission-mode',
      'dontAsk',
      '--settings',
      JSON.stringify(settings),
    ];
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
    ...toolFlags,
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

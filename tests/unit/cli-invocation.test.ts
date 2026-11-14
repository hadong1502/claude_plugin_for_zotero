// CLI invocation builders (#4): the arguments, the stdin message and the child
// environment of every Claude CLI run (#1 Implementation Decisions, Backend;
// #4 Global Constraints). Pure functions, so no fakes are needed.
import { describe, expect, it } from 'vitest';

import { buildCliArgs, buildStdinMessage, childEnvironment } from '../../src/core/cli-invocation';
import type { ClaudeRequest, ContentBlock } from '../../src/core/types';

function request(overrides: Partial<ClaudeRequest> = {}): ClaudeRequest {
  return {
    content: [{ type: 'text', text: 'What is this?' }],
    model: 'sonnet',
    systemPrompt: 'SP',
    readableFiles: [],
    ...overrides,
  };
}

describe('buildCliArgs', () => {
  it('args for a new question are exactly [...]', () => {
    expect(buildCliArgs(request())).toEqual([
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
      'SP',
      '--model',
      'sonnet',
      '--tools',
      '',
    ]);
  });

  it('args for a follow-up insert --resume <id> after --model <alias>', () => {
    const args = buildCliArgs(request({ resumeSessionId: 'abc' }));
    expect(args.slice(-5)).toEqual(['--model', 'sonnet', '--resume', 'abc', '--tools', '']);
  });

  it('args never contain --bare', () => {
    expect(buildCliArgs(request({ resumeSessionId: 'abc' }))).not.toContain('--bare');
  });

  it('args never contain the question text', () => {
    const args = buildCliArgs(request({ content: [{ type: 'text', text: 'QUESTION-MARKER' }] }));
    expect(args.some((a) => a.includes('QUESTION-MARKER'))).toBe(false);
  });

  it('readable files are rejected until #8: throws', () => {
    expect(() => buildCliArgs(request({ readableFiles: ['C:/p.pdf'] }))).toThrow(
      'buildCliArgs: readable files land in #8',
    );
  });
});

describe('buildStdinMessage', () => {
  const TEXT = 'He said "x\y"\nthen $\alpha$ — λ';

  it('stdin message round-trips quotes, backslashes, newlines and math', () => {
    const msg = buildStdinMessage([{ type: 'text', text: TEXT }]);
    expect(JSON.parse(msg.trimEnd())).toEqual({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: TEXT }] },
    });
  });

  it('stdin message is a single line ending in \n', () => {
    const msg = buildStdinMessage([{ type: 'text', text: TEXT }]);
    expect(msg.endsWith('\n') && !msg.slice(0, -1).includes('\n')).toBe(true);
  });

  it('image blocks become base64 source blocks', () => {
    const content: ContentBlock[] = [{ type: 'image', mediaType: 'image/png', data: 'QUJD' }];
    const msg = buildStdinMessage(content);
    expect(JSON.parse(msg.trimEnd()).message.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
    ]);
  });
});

describe('childEnvironment', () => {
  it('child environment removes CLAUDECODE, CLAUDE_CODE_* and CLAUDE_EFFORT', () => {
    expect(
      childEnvironment({
        PATH: 'p',
        CLAUDECODE: '1',
        CLAUDE_CODE_ENTRYPOINT: 'x',
        CLAUDE_EFFORT: 'high',
        CLAUDE_CONFIG_DIR: 'd',
        HOME: 'h',
      }),
    ).toEqual({ PATH: 'p', CLAUDE_CONFIG_DIR: 'd', HOME: 'h' });
  });
});

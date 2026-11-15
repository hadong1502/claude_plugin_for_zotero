// Scoped Read in the CLI arguments (#8 Task 2; flags and rule format from the
// #1 ADR, claude-code-cli-backend). Pure function, so no fakes are needed.
import { describe, expect, it } from 'vitest';

import { buildCliArgs } from '../../src/core/cli-invocation';
import type { ClaudeRequest } from '../../src/core/types';

const FILE = 'C:\\p\\a.pdf';
const WORKDIR = 'C:\\d\\w';

function request(overrides: Partial<ClaudeRequest> = {}): ClaudeRequest {
  return {
    content: [{ type: 'text', text: 'What is this?' }],
    model: 'sonnet',
    systemPrompt: 'SP',
    readableFiles: [],
    ...overrides,
  };
}

function readableArgs(overrides: Partial<ClaudeRequest> = {}): string[] {
  return buildCliArgs(request({ readableFiles: [FILE], ...overrides }), { workdir: WORKDIR });
}

describe('buildCliArgs with a readable file', () => {
  it('a readable PDF adds the Read flags after --model', () => {
    expect(readableArgs().slice(-8, -1)).toEqual([
      '--model',
      'sonnet',
      '--tools',
      'Read',
      '--permission-mode',
      'dontAsk',
      '--settings',
    ]);
  });

  it('the settings JSON allows the PDF and denies the workdir', () => {
    expect(JSON.parse(readableArgs().at(-1) as string)).toEqual({
      permissions: { allow: ['Read(//c/p/a.pdf)'], deny: ['Read(//c/d/w/**)'] },
    });
  });

  it('--resume stays before the tool flags', () => {
    const args = readableArgs({ resumeSessionId: 'abc' });
    const i = args.indexOf('--tools');
    expect(args.slice(i - 2, i)).toEqual(['--resume', 'abc']);
  });

  it('no --tools "" when a file is readable', () => {
    const args = readableArgs();
    expect(args[args.indexOf('--tools') + 1]).not.toBe('');
  });

  it('never --allowedTools or --bare', () => {
    const args = readableArgs();
    expect(args.filter((a) => a === '--allowedTools' || a === '--bare')).toEqual([]);
  });

  it('a readable file without a workdir throws', () => {
    expect(() => buildCliArgs(request({ readableFiles: [FILE] }))).toThrow(
      'buildCliArgs: workdir is required with a readable file',
    );
  });

  // #11 manual run: the paper's text file and the PDF are both readable.
  it('two readable files get one allow rule each', () => {
    const args = readableArgs({ readableFiles: ['C:\\p\\a.txt', 'C:\\p\\a.pdf'] });
    expect(JSON.parse(args.at(-1) as string).permissions.allow).toEqual([
      'Read(//c/p/a.txt)',
      'Read(//c/p/a.pdf)',
    ]);
  });

  it('the allow rules follow the readable-files order', () => {
    const args = readableArgs({ readableFiles: ['C:\\p\\a.pdf', 'C:\\p\\a.txt'] });
    expect(JSON.parse(args.at(-1) as string).permissions.allow).toEqual([
      'Read(//c/p/a.pdf)',
      'Read(//c/p/a.txt)',
    ]);
  });

  it('two readable files keep the one workdir deny rule', () => {
    const args = readableArgs({ readableFiles: ['C:\\p\\a.txt', 'C:\\p\\a.pdf'] });
    expect(JSON.parse(args.at(-1) as string).permissions.deny).toEqual(['Read(//c/d/w/**)']);
  });
});

describe('buildCliArgs without a readable file', () => {
  it('no readable files keeps the #4 arguments', () => {
    expect(buildCliArgs(request(), { workdir: WORKDIR })).toEqual([
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
});

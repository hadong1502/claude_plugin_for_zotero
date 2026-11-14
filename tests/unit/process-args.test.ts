// Empty option values for the Subprocess adapter (#4): Subprocess on Windows
// drops empty arguments, so they are passed as `--name=`.
import { describe, expect, it } from 'vitest';

import { buildCliArgs } from '../../src/core/cli-invocation';
import { foldEmptyOptionValues } from '../../src/core/process-args';

describe('foldEmptyOptionValues', () => {
  it('passes the CLI arguments with no empty argument and every other one unchanged', () => {
    const args = buildCliArgs({
      content: [{ type: 'text', text: 'q' }],
      model: 'haiku',
      systemPrompt: 'Say "hi" --tools \\ $x$',
      resumeSessionId: 'abc',
      readableFiles: [],
    });
    expect(foldEmptyOptionValues(args)).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--strict-mcp-config',
      '--setting-sources=',
      '--system-prompt',
      'Say "hi" --tools \\ $x$',
      '--model',
      'haiku',
      '--resume',
      'abc',
      '--tools=',
    ]);
  });

  it('folds an empty value of any long option', () => {
    expect(foldEmptyOptionValues(['--system-prompt', '', '-p'])).toEqual(['--system-prompt=', '-p']);
  });

  it('leaves a value that only looks like an option alone', () => {
    expect(foldEmptyOptionValues(['--system-prompt', '--tools', '--model', 'opus'])).toEqual([
      '--system-prompt',
      '--tools',
      '--model',
      'opus',
    ]);
  });
});

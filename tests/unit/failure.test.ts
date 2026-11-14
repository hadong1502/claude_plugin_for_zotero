// Failure classification and error copy (#4; messages from #1 user stories on
// plain-language errors). Black-box: evidence in, kind and message out.
// The rate-limit patterns are UNVERIFIED against a real CLI failure (#4).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { classifyFailure, errorCopy } from '../../src/core/failure';
import type { ErrorKind } from '../../src/core/types';

/** Parses the `result` line of a recorded CLI fixture (tests/fixtures/cli). */
function resultLine(name: string): { result?: string; errors?: string[] } {
  const text = readFileSync(join(__dirname, '../fixtures/cli', name), 'utf8');
  const line = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as { type: string })
    .find((o) => o.type === 'result');
  if (!line) throw new Error(`no result line in ${name}`);
  return line as { result?: string; errors?: string[] };
}

describe('classifyFailure', () => {
  it('authentication_failed is not-signed-in', () => {
    const r = classifyFailure({
      assistantErrorCode: 'authentication_failed',
      resultErrors: [],
      stderr: '',
      exitCode: 1,
    });
    expect(r.kind).toBe('not-signed-in');
  });

  it('"Not logged in · Please run /login" result text is not-signed-in', () => {
    // Literal from tests/fixtures/cli/error-not-signed-in.jsonl.
    const text = resultLine('error-not-signed-in.jsonl').result;
    expect(text).toBe('Not logged in · Please run /login');
    const r = classifyFailure({
      resultText: text,
      resultErrors: [],
      stderr: '',
      exitCode: 1,
    });
    expect(r.kind).toBe('not-signed-in');
  });

  it('a rate_limit_error code is rate-limited', () => {
    const r = classifyFailure({
      assistantErrorCode: 'rate_limit_error',
      resultErrors: [],
      stderr: '',
      exitCode: 1,
    });
    expect(r.kind).toBe('rate-limited');
  });

  it('"usage limit" in stderr is rate-limited', () => {
    const r = classifyFailure({
      resultErrors: [],
      stderr: 'Claude usage limit reached',
      exitCode: 1,
    });
    expect(r.kind).toBe('rate-limited');
  });

  it('model_not_found is failed with the result text as message', () => {
    // Literal from tests/fixtures/cli/error-model-not-found.jsonl.
    const text = resultLine('error-model-not-found.jsonl').result;
    expect(text).toBe(
      "There's an issue with the selected model (claude-nonexistent-9). It may not exist or you may not have access to it. Run --model to pick a different model.",
    );
    const r = classifyFailure({
      resultText: text,
      resultErrors: [],
      stderr: '',
      exitCode: 1,
    });
    expect(r).toEqual({ kind: 'failed', message: text });
  });

  it('resume-not-found errors are failed with the joined errors as message', () => {
    // errors[] from tests/fixtures/cli/error-resume-not-found.jsonl.
    const errors = resultLine('error-resume-not-found.jsonl').errors ?? [];
    expect(errors).toEqual([
      'No conversation found with session ID: 00000000-0000-4000-8000-000000000000',
    ]);
    const r = classifyFailure({
      resultErrors: errors,
      stderr: '',
      exitCode: 1,
    });
    expect(r).toEqual({
      kind: 'failed',
      message:
        'No conversation found with session ID: 00000000-0000-4000-8000-000000000000',
    });
  });

  it('a crash with empty stderr and exit 3 is failed "Claude CLI exited with code 3"', () => {
    const r = classifyFailure({ resultErrors: [], stderr: '', exitCode: 3 });
    expect(r).toEqual({
      kind: 'failed',
      message: 'Claude CLI exited with code 3',
    });
  });

  it("stderr's first line is used when there is no result", () => {
    const r = classifyFailure({
      resultErrors: [],
      stderr: '\n  boom happened\nsecond line\n',
      exitCode: 1,
    });
    expect(r).toEqual({ kind: 'failed', message: 'boom happened' });
  });
});

describe('errorCopy', () => {
  const cases: Array<[ErrorKind, string, string]> = [
    [
      'cli-not-found',
      '',
      'Claude Code CLI not found. Install Claude Code, or set its path in Settings → Claude.',
    ],
    [
      'not-signed-in',
      '',
      'Claude Code is not signed in. Run `claude` in a terminal and sign in, then ask again.',
    ],
    [
      'rate-limited',
      '',
      "You've reached your Claude usage limit. Try again later.",
    ],
    ['cancelled', '', 'Stopped.'],
    ['failed', 'boom', "Claude couldn't answer: boom"],
  ];

  it.each(cases)('errorCopy returns the exact message for %s', (kind, detail, expected) => {
    expect(errorCopy(kind, detail)).toBe(expected);
  });
});

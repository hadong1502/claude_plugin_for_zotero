// Read denials from the CLI stream (#8): the parser reports Reads the CLI
// denied, and the Runner exposes them after the stream ends. Fixtures are real
// CLI transcripts (#3).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ClaudeRunner } from '../../src/core/runner';
import { StreamJsonParser, type ParsedEvent } from '../../src/core/stream-parser';
import type { ClaudeRequest } from '../../src/core/types';
import { fakePort } from './helpers/fake-process';

function fixture(name: string): string {
  return readFileSync(join(__dirname, '../fixtures/cli', `${name}.jsonl`), 'utf8');
}

function parse(raw: string): ParsedEvent[] {
  const p = new StreamJsonParser();
  return [...p.push(raw), ...p.end()];
}

const request: ClaudeRequest = {
  content: [{ type: 'text', text: 'Read the file.' }],
  model: 'sonnet',
  systemPrompt: 'You help a researcher.',
  readableFiles: [],
};

async function drain(stdout: string): Promise<ClaudeRunner> {
  const fake = fakePort(stdout);
  const runner = new ClaudeRunner(fake.port, { cliPath: 'C:\tools\claude.exe', workdir: 'D:\wd' });
  for await (const _event of runner.ask(request)) {
    // drain
  }
  return runner;
}

describe('read denials in the parser', () => {
  it('denials are reported before the result', () => {
    const events = parse(fixture('read-allowed-and-denied'));
    const i = events.findIndex((e) => e.kind === 'read-denied');
    expect(events.slice(i, i + 2).map((e) => e.kind)).toEqual(['read-denied', 'result']);
  });

  it('the denial event names the denied secret.txt path', () => {
    const denied = parse(fixture('read-allowed-and-denied')).find((e) => e.kind === 'read-denied');
    expect(denied).toMatchObject({ paths: [expect.stringMatching(/secret\.txt$/)] });
  });

  it('no denial event when nothing was denied', () => {
    // Characterization: passes before implementation.
    expect(parse(fixture('normal-answer')).some((e) => e.kind === 'read-denied')).toBe(false);
  });

  it('the result is still the last parsed event', () => {
    // Characterization: passes before implementation.
    const events = parse(fixture('read-allowed-and-denied'));
    expect(events[events.length - 1].kind).toBe('result');
  });
});

describe('read denials in the runner', () => {
  it('the runner exposes denied reads after done', async () => {
    const runner = await drain(fixture('read-allowed-and-denied'));
    expect(runner.deniedReads()).toEqual([expect.stringMatching(/secret\.txt$/)]);
  });

  it('the runner reports no denials for a normal answer', async () => {
    const runner = await drain(fixture('normal-answer'));
    expect(runner.deniedReads()).toEqual([]);
  });
});

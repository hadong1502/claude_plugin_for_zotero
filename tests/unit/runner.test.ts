// Claude Runner (#4): one question through the CLI, replayed from real CLI
// transcripts (#3) via a fake Process Port. Expected values come from each
// fixture's own result line and from the contract builders in cli-invocation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildCliArgs, buildStdinMessage } from '../../src/core/cli-invocation';
import { ClaudeRunner } from '../../src/core/runner';
import type { AnswerEvent, ClaudeRequest } from '../../src/core/types';
import { fakePort, type FakePortOptions } from './helpers/fake-process';

const SESSION_ID = 'f61ad1cb-1c52-4f9c-a7eb-793b3dcb3c55';
const CLI_PATH = 'C:\\tools\\claude.exe';
const WORKDIR = 'D:\\zotero\\claude-for-zotero\\cli-workdir';

function fixture(name: string): string {
  return readFileSync(join(__dirname, '../fixtures/cli', name), 'utf8');
}

/** The fixture's own result line: the last line whose type is "result". */
function resultLine(raw: string): { result: string } {
  const lines = raw.split('\n').filter((l) => l.trim() !== '');
  const parsed = lines.map((l) => JSON.parse(l) as { type?: string; result: string });
  return [...parsed].reverse().find((e) => e.type === 'result')!;
}

const request: ClaudeRequest = {
  content: [{ type: 'text', text: 'Define "λ_k" in $H$.\nSay "hi" \\ ok' }],
  model: 'sonnet',
  systemPrompt: 'You help a researcher.',
  readableFiles: [],
};

function setup(stdout: string, opts?: FakePortOptions, cliPath = CLI_PATH) {
  const fake = fakePort(stdout, opts);
  const runner = new ClaudeRunner(fake.port, { cliPath, workdir: WORKDIR });
  return { fake, runner };
}

async function collect(runner: ClaudeRunner, req: ClaudeRequest = request): Promise<AnswerEvent[]> {
  const events: AnswerEvent[] = [];
  for await (const event of runner.ask(req)) events.push(event);
  return events;
}

const kinds = (events: AnswerEvent[]) => events.map((e) => e.type);

describe('ClaudeRunner', () => {
  it('normal-answer yields started, deltas, then done', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'));
    const events = await collect(runner);
    const shape = [events[0]?.type, events.slice(1, -1).every((e) => e.type === 'delta'), events.at(-1)?.type];
    expect(shape).toEqual(['started', true, 'done']);
  });

  it('normal-answer yields at least one delta', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'));
    expect((await collect(runner)).filter((e) => e.type === 'delta').length).toBeGreaterThan(0);
  });

  it('done.text equals the fixture result text', async () => {
    const raw = fixture('normal-answer.jsonl');
    const { runner } = setup(raw);
    expect((await collect(runner)).at(-1)).toMatchObject({ type: 'done', text: resultLine(raw).result });
  });

  it('done.sessionId is the fixture session id', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'));
    expect((await collect(runner)).at(-1)).toMatchObject({ type: 'done', sessionId: SESSION_ID });
  });

  it('started carries the fixture session id', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'));
    expect((await collect(runner))[0]).toEqual({ type: 'started', sessionId: SESSION_ID });
  });

  it('deltas concatenate to done.text', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'));
    const events = await collect(runner);
    const joined = events.flatMap((e) => (e.type === 'delta' ? [e.text] : [])).join('');
    expect(events.at(-1)).toMatchObject({ type: 'done', text: joined });
  });

  it('the process is spawned once with buildCliArgs(request) and the configured cliPath and workdir', async () => {
    const { fake, runner } = setup(fixture('normal-answer.jsonl'));
    await collect(runner);
    expect(fake.spawned).toEqual([{ command: CLI_PATH, args: buildCliArgs(request), workdir: WORKDIR }]);
  });

  it('the stdin receives buildStdinMessage(request.content)', async () => {
    const { fake, runner } = setup(fixture('normal-answer.jsonl'));
    await collect(runner);
    expect(fake.stdinWrites.join('')).toBe(buildStdinMessage(request.content));
  });

  it('the stdin is closed after the message is written', async () => {
    const { fake, runner } = setup(fixture('normal-answer.jsonl'));
    await collect(runner);
    expect(fake.stdinClosed()).toBe(true);
  });

  it("a follow-up passes --resume with the request's resumeSessionId", async () => {
    const { fake, runner } = setup(fixture('resumed-session.jsonl'));
    const followUp = { ...request, resumeSessionId: SESSION_ID };
    await collect(runner, followUp);
    expect(fake.spawned[0]?.args).toEqual(buildCliArgs(followUp));
  });

  it('not-signed-in fixture yields error not-signed-in', async () => {
    const { runner } = setup(fixture('error-not-signed-in.jsonl'), {
      stderr: fixture('error-not-signed-in.stderr.txt'),
      exitCode: 1,
    });
    expect((await collect(runner)).at(-1)).toMatchObject({ type: 'error', kind: 'not-signed-in' });
  });

  it('model-not-found fixture yields error failed', async () => {
    const { runner } = setup(fixture('error-model-not-found.jsonl'), {
      stderr: fixture('error-model-not-found.stderr.txt'),
      exitCode: 1,
    });
    expect((await collect(runner)).at(-1)).toMatchObject({ type: 'error', kind: 'failed' });
  });

  it('resume-not-found fixture yields only an error failed, no started', async () => {
    const { runner } = setup(fixture('error-resume-not-found.jsonl'), {
      stderr: fixture('error-resume-not-found.stderr.txt'),
      exitCode: 1,
    });
    const events = await collect(runner);
    expect(events.map((e) => (e.type === 'error' ? `error/${e.kind}` : e.type))).toEqual(['error/failed']);
  });

  it('stdout ending with no result and exit 3 yields error failed "Claude CLI exited with code 3"', async () => {
    const { runner } = setup('', { exitCode: 3 });
    expect(await collect(runner)).toEqual([
      { type: 'error', kind: 'failed', message: 'Claude CLI exited with code 3' },
    ]);
  });

  it('a missing executable yields error cli-not-found and nothing else', async () => {
    const { runner } = setup('', { notFound: true });
    expect(await collect(runner)).toEqual([{ type: 'error', kind: 'cli-not-found', message: CLI_PATH }]);
  });

  it('an empty cliPath yields error cli-not-found', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'), undefined, '');
    expect(await collect(runner)).toEqual([{ type: 'error', kind: 'cli-not-found', message: '' }]);
  });

  it('an empty cliPath does not spawn', async () => {
    const { fake, runner } = setup(fixture('normal-answer.jsonl'), undefined, '');
    await collect(runner);
    expect(fake.spawned.length).toBe(0);
  });

  // normal-answer.jsonl is 21881 chars; its first text_delta line ends at char
  // 4505 and the second at 4803. Hanging after 5000 (inside the first third,
  // 7293) guarantees whole delta lines are emitted before stdout stalls.
  it('cancel mid-stream ends with error cancelled after the deltas already yielded', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'), { hangAfterBytes: 5000 });
    const after: AnswerEvent[] = [];
    let cancelled = false;
    for await (const event of runner.ask(request)) {
      if (cancelled) after.push(event);
      if (event.type === 'delta' && !cancelled) {
        cancelled = true;
        runner.cancel();
      }
    }
    expect(after.filter((e) => e.type !== 'delta')).toEqual([{ type: 'error', kind: 'cancelled', message: '' }]);
  });

  it('cancel mid-stream kills the process', async () => {
    const { fake, runner } = setup(fixture('normal-answer.jsonl'), { hangAfterBytes: 5000 });
    for await (const event of runner.ask(request)) {
      if (event.type === 'delta') runner.cancel();
    }
    expect(fake.killed()).toBe(true);
  });

  it('cancel mid-stream yields no done', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'), { hangAfterBytes: 5000 });
    const events: AnswerEvent[] = [];
    for await (const event of runner.ask(request)) {
      events.push(event);
      if (event.type === 'delta') runner.cancel();
    }
    expect(kinds(events)).not.toContain('done');
  });

  it('nothing is retried', async () => {
    const { fake, runner } = setup(fixture('error-not-signed-in.jsonl'), { exitCode: 1 });
    await collect(runner);
    expect(fake.spawned.length).toBe(1);
  });

  it('a second ask while running yields error failed "Runner is busy"', async () => {
    const { runner } = setup(fixture('normal-answer.jsonl'), { hangAfterBytes: 5000 });
    const first = runner.ask(request)[Symbol.asyncIterator]();
    await first.next();
    const second = await collect(runner);
    runner.cancel();
    expect(second).toEqual([{ type: 'error', kind: 'failed', message: 'Runner is busy' }]);
  });

  it('1-byte chunks give the same events as whole output', async () => {
    const raw = fixture('normal-answer.jsonl');
    const whole = await collect(setup(raw).runner);
    const bytes = await collect(setup(raw, { chunkSize: 1 }).runner);
    expect(bytes).toEqual(whole);
  });
});

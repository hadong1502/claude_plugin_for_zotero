// Claude Runner with a readable file (#8): the runner passes its own workdir to
// the CLI arguments so the Read tool is scoped to the one PDF, and degrades to
// the no-file form when the workdir has no verified rule path.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ClaudeRunner } from '../../src/core/runner';
import type { AnswerEvent, ClaudeRequest } from '../../src/core/types';
import { fakePort } from './helpers/fake-process';

const CLI_PATH = 'C:\\tools\\claude.exe';
const WORKDIR = 'D:\\zotero\\claude-for-zotero\\cli-workdir';

const normalAnswer = readFileSync(join(__dirname, '../fixtures/cli/normal-answer.jsonl'), 'utf8');

function requestWith(files: string[]): ClaudeRequest {
  return {
    content: [{ type: 'text', text: 'Q' }],
    model: 'sonnet',
    systemPrompt: 'You help a researcher.',
    readableFiles: files,
  };
}

async function run(workdir: string, req: ClaudeRequest) {
  const fake = fakePort(normalAnswer);
  const runner = new ClaudeRunner(fake.port, { cliPath: CLI_PATH, workdir });
  const events: AnswerEvent[] = [];
  for await (const event of runner.ask(req)) events.push(event);
  return { fake, events };
}

describe('ClaudeRunner with a readable file', () => {
  it('ClaudeRunner passes its workdir to the CLI arguments', async () => {
    const { fake } = await run(WORKDIR, requestWith(['C:\\p\\a.pdf']));
    expect(fake.spawned[0]?.args).toContain('--permission-mode');
  });

  it('the settings JSON denies reading the runner workdir', async () => {
    const { fake } = await run(WORKDIR, requestWith(['C:\\p\\a.pdf']));
    const args = fake.spawned[0]?.args ?? [];
    const settings = JSON.parse(args[args.indexOf('--settings') + 1] ?? '{}') as {
      permissions: { deny: string[] };
    };
    expect(settings.permissions.deny).toEqual(['Read(//d/zotero/claude-for-zotero/cli-workdir/**)']);
  });

  it('the settings JSON allows reading only the file', async () => {
    const { fake } = await run(WORKDIR, requestWith(['C:\\p\\a.pdf']));
    const args = fake.spawned[0]?.args ?? [];
    const settings = JSON.parse(args[args.indexOf('--settings') + 1] ?? '{}') as {
      permissions: { allow: string[] };
    };
    expect(settings.permissions.allow).toEqual(['Read(//c/p/a.pdf)']);
  });

  it('an unverified workdir drops the readable file instead of failing', async () => {
    const { fake } = await run('C:\\Zo\u00eb\\w', requestWith(['C:\\p\\a.pdf']));
    const args = fake.spawned[0]?.args ?? [];
    expect({
      permissionMode: args.includes('--permission-mode'),
      tools: args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2),
    }).toEqual({ permissionMode: false, tools: ['--tools', ''] });
  });

  it('an unverified workdir still yields the done event', async () => {
    const { events } = await run('C:\\Zo\u00eb\\w', requestWith(['C:\\p\\a.pdf']));
    expect(events.at(-1)?.type).toBe('done');
  });
});

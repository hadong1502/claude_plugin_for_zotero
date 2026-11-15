// Ask Controller prior exchange (#10): the next question after Continue in Pane
// carries the held exchange once, and an imported session id is resumed (#1 user
// stories 21 and 22). The scripted runner is a boundary fake for the CLI; the
// Thread Store and Context Builder are real.
import { describe, expect, it } from 'vitest';

import { AskController, type RunnerLike } from '../../src/core/ask-controller';
import { buildQuestion } from '../../src/core/context-builder';
import { ThreadStore } from '../../src/core/thread-store';
import type { AnswerEvent, ClaudeRequest, ItemContext } from '../../src/core/types';

const KEY = 7;
const ITEM: ItemContext = { title: 'Attention Is All You Need', creators: ['Vaswani'], year: '2017' };
const SETTINGS = { aboutMe: 'A physics PhD student', answerLanguage: 'English' };
const IMPORTED = { question: 'Why λ?', answer: 'A rate.', model: 'opus' as const };

class Runner implements RunnerLike {
  readonly requests: ClaudeRequest[] = [];
  readonly #events: AnswerEvent[];
  constructor(sessionId = 's1') {
    this.#events = [
      { type: 'delta', text: 'A' },
      { type: 'done', text: 'A', sessionId },
    ];
  }
  cancel(): void {}
  async *ask(request: ClaudeRequest): AsyncGenerator<AnswerEvent> {
    this.requests.push(request);
    yield* this.#events;
  }
}

function setup(runners: Runner[]) {
  const store = new ThreadStore();
  let created = 0;
  const controller = new AskController({
    store,
    createRunner: async () => runners[created++] ?? null,
    settings: () => SETTINGS,
  });
  return { store, controller };
}

function contentOf(request: ClaudeRequest): string {
  const block = request.content[0];
  return block.type === 'text' ? block.text : '';
}

/** A non-empty Thread (first question answered), then an import with no session id. */
async function withHeldExchange(runners: Runner[]) {
  const ctx = setup(runners);
  await ctx.controller.ask(KEY, ITEM, 'First?', 'sonnet');
  ctx.store.importExchange(KEY, { ...IMPORTED, sessionId: undefined });
  return ctx;
}

describe('AskController prior exchange', () => {
  it('the next question carries the held prior exchange', async () => {
    const second = new Runner();
    const { controller } = await withHeldExchange([new Runner(), second]);
    await controller.ask(KEY, ITEM, 'Next?', 'sonnet');
    const built = buildQuestion({
      item: ITEM,
      question: 'Next?',
      paperContext: 'none',
      ...SETTINGS,
      priorExchange: { question: IMPORTED.question, answer: IMPORTED.answer },
    });
    expect(second.requests[0].content).toEqual(built.content);
  });

  it('the prior exchange is sent only once', async () => {
    const third = new Runner();
    const { controller } = await withHeldExchange([new Runner(), new Runner(), third]);
    await controller.ask(KEY, ITEM, 'Next?', 'sonnet');
    await controller.ask(KEY, ITEM, 'Again?', 'sonnet');
    expect(contentOf(third.requests[0])).not.toContain('Earlier in this conversation');
  });

  it('a follow-up after importing into an empty Thread resumes the inline session', async () => {
    const runner = new Runner();
    const { store, controller } = setup([runner]);
    store.importExchange(KEY, { ...IMPORTED, sessionId: 'sid-1' });
    await controller.ask(KEY, ITEM, 'Next?', 'sonnet');
    expect(runner.requests[0].resumeSessionId).toBe('sid-1');
  });

  it('a no-op ask does not consume the prior exchange', async () => {
    const { store, controller } = await withHeldExchange([new Runner()]);
    await controller.ask(KEY, ITEM, '  ', 'sonnet');
    expect(store.takePriorExchange(KEY)).toBeDefined();
  });
});

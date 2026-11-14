// Ask Controller (#4): a question runs one turn per Thread; Runner events map
// onto the Thread Store; Clear and Stop cancel the run so late events never
// reach a cleared Thread (#4; #1 user stories on follow-ups, Stop and Clear).
// The scripted runner is a boundary fake for the CLI process; the Thread Store
// and Context Builder are real.
import { describe, expect, it } from 'vitest';

import { AskController, type RunnerLike } from '../../src/core/ask-controller';
import { buildQuestion } from '../../src/core/context-builder';
import { ThreadStore } from '../../src/core/thread-store';
import type { AnswerEvent, ClaudeRequest, ItemContext } from '../../src/core/types';

const KEY = 7;
const OTHER_KEY = 8;
const ITEM: ItemContext = {
  title: 'Attention Is All You Need',
  creators: ['Vaswani', 'Shazeer'],
  year: '2017',
  abstract: 'We propose the Transformer.',
};
const SETTINGS = { aboutMe: 'A physics PhD student', answerLanguage: 'English' };

type Step =
  | AnswerEvent
  | { pause: true } // waits until released or cancelled
  | { throws: Error };

class ScriptedRunner implements RunnerLike {
  readonly requests: ClaudeRequest[] = [];
  cancelCount = 0;
  /** Resolves once the script reaches its pause step. */
  readonly paused: Promise<void>;
  #markPaused!: () => void;
  #release!: () => void;
  readonly #released: Promise<void>;
  #cancel!: () => void;
  readonly #cancelled: Promise<void>;
  #wasCancelled = false;
  readonly #steps: Step[];
  readonly #ignoreCancel: boolean;

  constructor(steps: Step[], options: { ignoreCancel?: boolean } = {}) {
    this.#steps = steps;
    this.#ignoreCancel = options.ignoreCancel ?? false;
    this.paused = new Promise<void>((r) => (this.#markPaused = r));
    this.#released = new Promise<void>((r) => (this.#release = r));
    this.#cancelled = new Promise<void>((r) => (this.#cancel = r));
  }

  release(): void {
    this.#release();
  }

  cancel(): void {
    this.cancelCount++;
    this.#wasCancelled = true;
    this.#cancel();
  }

  async *ask(request: ClaudeRequest): AsyncGenerator<AnswerEvent> {
    this.requests.push(request);
    for (const step of this.#steps) {
      if ('pause' in step) {
        this.#markPaused();
        await Promise.race([this.#released, this.#cancelled]);
        if (this.#wasCancelled && !this.#ignoreCancel) {
          yield { type: 'error', kind: 'cancelled', message: '' };
          return;
        }
      } else if ('throws' in step) {
        throw step.throws;
      } else {
        yield step;
      }
    }
  }
}

function setup(runners: (ScriptedRunner | null)[]) {
  const store = new ThreadStore();
  let created = 0;
  const controller = new AskController({
    store,
    createRunner: async () => {
      const runner = runners[created] ?? null;
      created++;
      return runner;
    },
    settings: () => SETTINGS,
  });
  return { store, controller, createdCount: () => created };
}

const answer = (text: string, sessionId = 's1'): Step[] => [
  { type: 'started', sessionId },
  { type: 'delta', text },
  { type: 'done', text, sessionId },
];

const partial = (): Step[] => [{ type: 'delta', text: 'part' }, { pause: true }];

describe('AskController', () => {
  it('asking appends a pane turn with the trimmed question', async () => {
    const { store, controller } = setup([new ScriptedRunner(answer('A'))]);
    await controller.ask(KEY, ITEM, '  What is attention?  ', 'opus');
    const turn = store.get(KEY).turns[0];
    expect([turn.question, turn.source, turn.model]).toEqual(['What is attention?', 'pane', 'opus']);
  });

  it('streams deltas into the turn answer', async () => {
    const runner = new ScriptedRunner([
      { type: 'delta', text: 'Hel' },
      { type: 'delta', text: 'lo' },
      { pause: true },
    ]);
    const { store, controller } = setup([runner]);
    const run = controller.ask(KEY, ITEM, 'Hi', 'sonnet');
    await runner.paused;
    const answerSoFar = store.get(KEY).turns[0]?.answer;
    controller.stop(KEY);
    await run;
    expect(answerSoFar).toBe('Hello');
  });

  it('done finishes the turn as done', async () => {
    const { store, controller } = setup([new ScriptedRunner(answer('Full answer'))]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    expect(store.get(KEY).turns[0].status).toBe('done');
  });

  it('done records the session id on the thread', async () => {
    const { store, controller } = setup([new ScriptedRunner(answer('A', 'sess-42'))]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    expect(store.get(KEY).sessionId).toBe('sess-42');
  });

  it('the first question has no session to resume', async () => {
    const runner = new ScriptedRunner(answer('A'));
    const { controller } = setup([runner]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    expect(runner.requests[0].resumeSessionId).toBeUndefined();
  });

  it('the second question resumes the thread session id', async () => {
    const second = new ScriptedRunner(answer('B', 's2'));
    const { controller } = setup([new ScriptedRunner(answer('A', 's1')), second]);
    await controller.ask(KEY, ITEM, 'Q1', 'sonnet');
    await controller.ask(KEY, ITEM, 'Q2', 'sonnet');
    expect(second.requests[0].resumeSessionId).toBe('s1');
  });

  it('the request carries the built system prompt and content for the item', async () => {
    const runner = new ScriptedRunner(answer('A'));
    const { controller } = setup([runner]);
    await controller.ask(KEY, ITEM, '  What is attention?  ', 'haiku');
    const built = buildQuestion({
      item: ITEM,
      question: 'What is attention?',
      paperContext: 'none',
      ...SETTINGS,
    });
    expect(runner.requests[0]).toEqual({ ...built, model: 'haiku' });
  });

  it('a blank question does nothing', async () => {
    const { store, controller, createdCount } = setup([new ScriptedRunner(answer('A'))]);
    await controller.ask(KEY, ITEM, '', 'sonnet');
    expect([store.get(KEY).turns.length, createdCount()]).toEqual([0, 0]);
  });

  it('a whitespace-only question does nothing', async () => {
    const { store, controller, createdCount } = setup([new ScriptedRunner(answer('A'))]);
    await controller.ask(KEY, ITEM, ' \n\t ', 'sonnet');
    expect([store.get(KEY).turns.length, createdCount()]).toEqual([0, 0]);
  });

  it('asking while the thread is running does nothing', async () => {
    const first = new ScriptedRunner([{ pause: true }]);
    const { store, controller, createdCount } = setup([first, new ScriptedRunner(answer('B'))]);
    const run = controller.ask(KEY, ITEM, 'Q1', 'sonnet');
    await first.paused;
    await controller.ask(KEY, ITEM, 'Q2', 'sonnet');
    const observed = [store.get(KEY).turns.length, createdCount()];
    first.release();
    await run;
    expect(observed).toEqual([1, 1]);
  });

  it('a second ask in the same tick starts only one turn', async () => {
    const { store, controller, createdCount } = setup([
      new ScriptedRunner(answer('A')),
      new ScriptedRunner(answer('B')),
    ]);
    const first = controller.ask(KEY, ITEM, 'Q1', 'sonnet');
    const second = controller.ask(KEY, ITEM, 'Q2', 'sonnet');
    await Promise.all([first, second]);
    expect([store.get(KEY).turns.length, createdCount()]).toEqual([1, 1]);
  });

  it('a different thread can run while another is running', async () => {
    const first = new ScriptedRunner([{ pause: true }]);
    const { store, controller } = setup([first, new ScriptedRunner(answer('B'))]);
    const run = controller.ask(KEY, ITEM, 'Q1', 'sonnet');
    await first.paused;
    await controller.ask(OTHER_KEY, ITEM, 'Q2', 'sonnet');
    const status = store.get(OTHER_KEY).turns[0]?.status;
    first.release();
    await run;
    expect(status).toBe('done');
  });

  it('no CLI fails the turn with cli-not-found and an empty message', async () => {
    const { store, controller } = setup([null]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    const turn = store.get(KEY).turns[0];
    expect([turn.status, turn.error]).toEqual(['error', { kind: 'cli-not-found', message: '' }]);
  });

  it('stop cancels the runner', async () => {
    const runner = new ScriptedRunner(partial());
    const { controller } = setup([runner]);
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    await runner.paused;
    controller.stop(KEY);
    await run;
    expect(runner.cancelCount).toBe(1);
  });

  it('stop ends the turn stopped', async () => {
    const runner = new ScriptedRunner(partial());
    const { store, controller } = setup([runner]);
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    await runner.paused;
    controller.stop(KEY);
    await run;
    expect(store.get(KEY).turns[0].status).toBe('stopped');
  });

  it('stop keeps the partial answer', async () => {
    const runner = new ScriptedRunner(partial());
    const { store, controller } = setup([runner]);
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    await runner.paused;
    controller.stop(KEY);
    await run;
    expect(store.get(KEY).turns[0].answer).toBe('part');
  });

  it('clear while running cancels the runner', async () => {
    const runner = new ScriptedRunner([{ pause: true }]);
    const { controller } = setup([runner]);
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    await runner.paused;
    controller.clear(KEY);
    await run;
    expect(runner.cancelCount).toBe(1);
  });

  it('clear while running leaves an empty thread', async () => {
    const runner = new ScriptedRunner([{ pause: true }]);
    const { store, controller } = setup([runner]);
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    await runner.paused;
    controller.clear(KEY);
    await run;
    expect(store.get(KEY)).toEqual({ key: KEY, turns: [] });
  });

  it('late deltas after clear do not bring a turn back', async () => {
    // The fake ignores cancel and keeps emitting, as a late stdout chunk would.
    const runner = new ScriptedRunner(
      [
        { pause: true },
        { type: 'delta', text: 'late' },
        { type: 'done', text: 'late', sessionId: 'sx' },
      ],
      { ignoreCancel: true },
    );
    const { store, controller } = setup([runner]);
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    await runner.paused;
    controller.clear(KEY);
    runner.release();
    await run;
    expect(store.get(KEY)).toEqual({ key: KEY, turns: [] });
  });

  it('an error event fails the turn with its kind and message', async () => {
    const { store, controller } = setup([
      new ScriptedRunner([{ type: 'error', kind: 'rate-limited', message: 'slow down' }]),
    ]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    const turn = store.get(KEY).turns[0];
    expect([turn.status, turn.error]).toEqual([
      'error',
      { kind: 'rate-limited', message: 'slow down' },
    ]);
  });

  it('a cancelled error event stops the turn instead of failing it', async () => {
    const { store, controller } = setup([
      new ScriptedRunner([
        { type: 'delta', text: 'x' },
        { type: 'error', kind: 'cancelled', message: '' },
      ]),
    ]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    expect(store.get(KEY).turns[0].status).toBe('stopped');
  });

  it('a started event does not add to the answer', async () => {
    const { store, controller } = setup([
      new ScriptedRunner([
        { type: 'started', sessionId: 's9' },
        { type: 'error', kind: 'cancelled', message: '' },
      ]),
    ]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    expect(store.get(KEY).turns[0].answer).toBe('');
  });

  it('a throwing runner fails the turn as failed with the error text', async () => {
    const { store, controller } = setup([new ScriptedRunner([{ throws: new Error('boom') }])]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    const turn = store.get(KEY).turns[0];
    expect([turn.status, turn.error]).toEqual([
      'error',
      { kind: 'failed', message: String(new Error('boom')) },
    ]);
  });

  it('cancelAll cancels every running thread', async () => {
    const a = new ScriptedRunner([{ pause: true }]);
    const b = new ScriptedRunner([{ pause: true }]);
    const { controller } = setup([a, b]);
    const runA = controller.ask(KEY, ITEM, 'Q1', 'sonnet');
    const runB = controller.ask(OTHER_KEY, ITEM, 'Q2', 'sonnet');
    await Promise.all([a.paused, b.paused]);
    controller.cancelAll();
    await Promise.all([runA, runB]);
    expect([a.cancelCount, b.cancelCount]).toEqual([1, 1]);
  });

  it('isRunning is false before any question', () => {
    const { controller } = setup([]);
    expect(controller.isRunning(KEY)).toBe(false);
  });

  it('isRunning is true while a question runs', async () => {
    const runner = new ScriptedRunner([{ pause: true }]);
    const { controller } = setup([runner]);
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    await runner.paused;
    const running = controller.isRunning(KEY);
    runner.release();
    await run;
    expect(running).toBe(true);
  });

  it('isRunning is false after the run ends', async () => {
    const { controller } = setup([new ScriptedRunner(answer('A'))]);
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    expect(controller.isRunning(KEY)).toBe(false);
  });
});

describe('AskController stop before the runner exists', () => {
  function setupDeferred() {
    const store = new ThreadStore();
    const runner = new ScriptedRunner(answer('A'));
    let resolveRunner!: (r: RunnerLike) => void;
    const controller = new AskController({
      store,
      createRunner: () => new Promise<RunnerLike>((r) => (resolveRunner = r)),
      settings: () => SETTINGS,
    });
    return { store, controller, runner, resolveRunner: (r: RunnerLike) => resolveRunner(r) };
  }

  it('stop while the runner is being created ends the turn stopped without starting a run', async () => {
    const { store, controller, runner, resolveRunner } = setupDeferred();
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    controller.stop(KEY);
    resolveRunner(runner);
    await run;
    expect([store.get(KEY).turns[0].status, runner.requests.length, controller.isRunning(KEY)]).toEqual([
      'stopped',
      0,
      false,
    ]);
  });

  it('cancelAll while the runner is being created ends the turn stopped without starting a run', async () => {
    const { store, controller, runner, resolveRunner } = setupDeferred();
    const run = controller.ask(KEY, ITEM, 'Q', 'sonnet');
    controller.cancelAll();
    resolveRunner(runner);
    await run;
    expect([store.get(KEY).turns[0].status, runner.requests.length]).toEqual(['stopped', 0]);
  });
});

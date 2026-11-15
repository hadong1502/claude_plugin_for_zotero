// Stop and Clear while the paper text is still loading (#8, #4): the run ends
// at once, never starts the CLI, and never consumes a held prior exchange.
import { describe, expect, it, vi } from 'vitest';

import { AskController, type RunnerLike } from '../../src/core/ask-controller';
import { ThreadStore } from '../../src/core/thread-store';
import type { AnswerEvent, ClaudeRequest, ItemContext } from '../../src/core/types';

const KEY = 8;
const ITEM: ItemContext = { title: 'T', creators: ['A'], year: '2017', abstract: 'Abs.' };
const SETTINGS = { aboutMe: 'A student', answerLanguage: 'English' };
const UNVERIFIED_PDF = 'C:\Zo\u00eb\a.pdf';

class FakeRunner implements RunnerLike {
  readonly requests: ClaudeRequest[] = [];
  cancel(): void {}
  async *ask(request: ClaudeRequest): AsyncGenerator<AnswerEvent> {
    this.requests.push(request);
    yield { type: 'done', text: 'A', sessionId: 's1' };
  }
}

/** A forced ask whose extracted text never arrives until `settle` is called. */
function pendingLoad() {
  let settle: (text: string) => void = () => {};
  const loadText = vi.fn(() => new Promise<string | undefined>((resolve) => (settle = resolve)));
  return { paper: { pdfPath: UNVERIFIED_PDF, loadText }, loadText, settle: (t: string) => settle(t) };
}

function setup() {
  const runner = new FakeRunner();
  const store = new ThreadStore();
  const controller = new AskController({ store, createRunner: async () => runner, settings: () => SETTINGS });
  return { runner, store, controller };
}

async function loading(controller: AskController, paper: ReturnType<typeof pendingLoad>) {
  const done = controller.ask(KEY, ITEM, 'Q?', 'sonnet', { useFullPaper: true, paper: paper.paper });
  await vi.waitFor(() => expect(paper.loadText).toHaveBeenCalled());
  return done;
}

describe('AskController Stop and Clear during a paper load', () => {
  it('Stop while the paper text is loading stops the turn', async () => {
    const { store, controller } = setup();
    const paper = pendingLoad();
    const done = loading(controller, paper);
    await vi.waitFor(() => expect(paper.loadText).toHaveBeenCalled());
    controller.stop(KEY);
    await done;
    expect({ status: store.get(KEY).turns[0]?.status, running: controller.isRunning(KEY) }).toEqual({
      status: 'stopped',
      running: false,
    });
  });

  it('Stop while the paper text is loading does not start a run', async () => {
    const { runner, controller } = setup();
    const paper = pendingLoad();
    const done = loading(controller, paper);
    await vi.waitFor(() => expect(paper.loadText).toHaveBeenCalled());
    controller.stop(KEY);
    await done;
    paper.settle('late text');
    await Promise.resolve();
    expect(runner.requests).toEqual([]);
  });

  it('Stop while the paper text is loading keeps the held prior exchange', async () => {
    const { store, controller } = setup();
    store.importExchange(KEY, { question: 'Old?', answer: 'Older.', model: 'sonnet' });
    const paper = pendingLoad();
    const done = loading(controller, paper);
    await vi.waitFor(() => expect(paper.loadText).toHaveBeenCalled());
    controller.stop(KEY);
    await done;
    expect(store.takePriorExchange(KEY)).toEqual({ question: 'Old?', answer: 'Older.' });
  });

  it('Clear while the paper text is loading leaves the Thread empty', async () => {
    const { runner, store, controller } = setup();
    const paper = pendingLoad();
    const done = loading(controller, paper);
    await vi.waitFor(() => expect(paper.loadText).toHaveBeenCalled());
    controller.clear(KEY);
    await done;
    paper.settle('late text');
    await Promise.resolve();
    expect({ turns: store.get(KEY).turns, requests: runner.requests.length }).toEqual({ turns: [], requests: 0 });
  });
});

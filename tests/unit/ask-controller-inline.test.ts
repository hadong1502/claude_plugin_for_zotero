// Acceptance tests for the Ask Controller options (#7): the Selection, Quick
// Action and turn source pass through to the Thread Store and the request
// (#1 user stories 17-20, 24, 25). The fake runner is a boundary fake for the
// CLI process; the Thread Store and Context Builder are real.
import { describe, expect, it } from 'vitest';

import { AskController, type RunnerLike } from '../../src/core/ask-controller';
import { buildQuestion } from '../../src/core/context-builder';
import { ThreadStore } from '../../src/core/thread-store';
import type {
  AnswerEvent,
  ClaudeRequest,
  ItemContext,
  SelectionContext,
} from '../../src/core/types';

const KEY = 7;
const ITEM: ItemContext = {
  title: 'Attention Is All You Need',
  creators: ['Vaswani', 'Shazeer'],
  year: '2017',
  abstract: 'We propose the Transformer.',
};
const SETTINGS = { aboutMe: 'A physics PhD student', answerLanguage: 'English' };
const SELECTION: SelectionContext = { text: 'softmax(QK^T / sqrt(d_k))V', pageLabel: '4' };

class FakeRunner implements RunnerLike {
  readonly requests: ClaudeRequest[] = [];

  cancel(): void {}

  async *ask(request: ClaudeRequest): AsyncGenerator<AnswerEvent> {
    this.requests.push(request);
    yield { type: 'started', sessionId: 's1' };
    yield { type: 'delta', text: 'A' };
    yield { type: 'done', text: 'A', sessionId: 's1' };
  }
}

function setup(runner: FakeRunner) {
  const store = new ThreadStore();
  const controller = new AskController({
    store,
    createRunner: async () => runner,
    settings: () => SETTINGS,
  });
  return { store, controller };
}

describe('AskController options', () => {
  it('options pass the Selection and Quick Action into the request', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'Explain the math', 'haiku', {
      quickAction: 'explain-math',
      selection: SELECTION,
    });
    const expected = {
      ...buildQuestion({
        item: ITEM,
        question: 'Explain the math',
        quickAction: 'explain-math',
        selection: SELECTION,
        paperContext: 'none',
        ...SETTINGS,
      }),
      model: 'haiku',
      resumeSessionId: undefined,
    };
    expect(runner.requests[0]).toEqual(expected);
  });

  it('inline source is recorded on the turn', async () => {
    const { store, controller } = setup(new FakeRunner());
    await controller.ask(KEY, ITEM, 'Q', 'sonnet', { source: 'inline' });
    expect(store.get(KEY).turns[0].source).toBe('inline');
  });

  // Characterization: #4 already records 'pane' when no options are given.
  it('source defaults to pane', async () => {
    const { store, controller } = setup(new FakeRunner());
    await controller.ask(KEY, ITEM, 'Q', 'sonnet');
    expect(store.get(KEY).turns[0].source).toBe('pane');
  });

  // Characterization: the stub ignores options, so the trimmed question argument
  // is already the displayed question; this guards against the implementation
  // showing the Quick Action wording instead.
  it('the displayed question is the label passed in', async () => {
    const { store, controller } = setup(new FakeRunner());
    await controller.ask(KEY, ITEM, 'Explain the math', 'haiku', {
      quickAction: 'explain-math',
      selection: SELECTION,
    });
    expect(store.get(KEY).turns[0].question).toBe('Explain the math');
  });
});

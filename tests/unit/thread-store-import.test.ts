// Thread Store importExchange (#10): Continue in Pane moves an Inline Question
// and its Answer into the Thread (#1 user stories 21 and 22). An empty Thread
// adopts the session id; otherwise the exchange is held as one-shot prior context.
import { describe, expect, it, vi } from 'vitest';

import { ThreadStore } from '../../src/core/thread-store';

const KEY = 7;
const EXCHANGE = { question: 'Why λ?', answer: 'Because $\lambda$ is a rate.', model: 'opus' as const };

function nonEmpty(store: ThreadStore, sessionId = 'sid-0'): void {
  const id = store.appendQuestion(KEY, 'First?', 'sonnet', 'pane');
  store.finish(KEY, id, sessionId);
}

describe('ThreadStore importExchange', () => {
  it('importing into an empty Thread adds a done inline turn', () => {
    const store = new ThreadStore();
    store.importExchange(KEY, { ...EXCHANGE, sessionId: 'sid-1' });
    const turns = store.get(KEY).turns.map(({ question, answer, model, status, source }) => ({
      question,
      answer,
      model,
      status,
      source,
    }));
    expect(turns).toEqual([
      { question: EXCHANGE.question, answer: EXCHANGE.answer, model: 'opus', status: 'done', source: 'inline' },
    ]);
  });

  it('importing into an empty Thread adopts the session id', () => {
    const store = new ThreadStore();
    store.importExchange(KEY, { ...EXCHANGE, sessionId: 'sid-1' });
    expect(store.get(KEY).sessionId).toBe('sid-1');
  });

  it('importing into an empty Thread holds no prior context', () => {
    const store = new ThreadStore();
    store.importExchange(KEY, { ...EXCHANGE, sessionId: 'sid-1' });
    expect(store.takePriorExchange(KEY)).toBeUndefined();
  });

  it('importing into a non-empty Thread keeps its session id', () => {
    const store = new ThreadStore();
    nonEmpty(store);
    store.importExchange(KEY, { ...EXCHANGE, sessionId: 'sid-1' });
    expect(store.get(KEY).sessionId).toBe('sid-0');
  });

  it('importing into a non-empty Thread appends the turn last', () => {
    const store = new ThreadStore();
    nonEmpty(store);
    store.importExchange(KEY, { ...EXCHANGE, sessionId: 'sid-1' });
    expect(store.get(KEY).turns.map((t) => t.question)).toEqual(['First?', EXCHANGE.question]);
  });

  it('importing into a non-empty Thread holds the exchange as prior context', () => {
    const store = new ThreadStore();
    nonEmpty(store);
    store.importExchange(KEY, { ...EXCHANGE, sessionId: 'sid-1' });
    expect(store.takePriorExchange(KEY)).toEqual({
      question: EXCHANGE.question,
      answer: EXCHANGE.answer,
    });
  });

  it('importing without a session id holds prior context even on an empty Thread', () => {
    const store = new ThreadStore();
    store.importExchange(KEY, { ...EXCHANGE });
    expect(store.takePriorExchange(KEY)).toBeDefined();
  });

  it('importing without a session id leaves the session id undefined', () => {
    const store = new ThreadStore();
    store.importExchange(KEY, { ...EXCHANGE });
    expect(store.get(KEY).sessionId).toBeUndefined();
  });

  it('a second import replaces the held prior context', () => {
    const store = new ThreadStore();
    store.importExchange(KEY, { ...EXCHANGE });
    store.importExchange(KEY, { ...EXCHANGE, question: 'Second?', answer: 'Two.' });
    expect(store.takePriorExchange(KEY)).toEqual({ question: 'Second?', answer: 'Two.' });
  });

  it('prior context is taken only once', () => {
    const store = new ThreadStore();
    store.importExchange(KEY, { ...EXCHANGE });
    store.takePriorExchange(KEY);
    expect(store.takePriorExchange(KEY)).toBeUndefined();
  });

  it('clear forgets held prior context', () => {
    const store = new ThreadStore();
    store.importExchange(KEY, { ...EXCHANGE });
    store.clear(KEY);
    expect(store.takePriorExchange(KEY)).toBeUndefined();
  });

  it('import notifies subscribers once with the key', () => {
    const store = new ThreadStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.importExchange(KEY, { ...EXCHANGE, sessionId: 'sid-1' });
    expect(listener.mock.calls).toEqual([[KEY]]);
  });
});

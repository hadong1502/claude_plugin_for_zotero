// Thread Store (#4): pure in-memory Threads keyed by item; mutations notify
// subscribers with the key, and events naming an unknown key or turn id are
// silent no-ops so late events after Clear are dropped (#4; #1 user stories on
// follow-ups and Clear). Turn ids are opaque: only uniqueness and addressing
// are asserted.
import { describe, expect, it, vi } from 'vitest';

import { ThreadStore } from '../../src/core/thread-store';

const KEY = 7;
const OTHER_KEY = 8;

function askOne(store: ThreadStore, key = KEY, question = 'What is a kernel?'): string {
  return store.appendQuestion(key, question, 'sonnet', 'pane');
}

describe('ThreadStore', () => {
  it('get on a new key returns an empty thread', () => {
    const store = new ThreadStore();
    expect(store.get(KEY)).toEqual({ key: KEY, turns: [] });
  });

  it('get on an unknown key does not notify', () => {
    const store = new ThreadStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.get(KEY);
    expect(listener).not.toHaveBeenCalled();
  });

  it('appendQuestion adds a streaming turn with an empty answer and returns its id', () => {
    const store = new ThreadStore();
    const id = store.appendQuestion(KEY, 'Why λ?', 'haiku', 'inline');
    expect(store.get(KEY).turns).toEqual([
      { id, question: 'Why λ?', answer: '', model: 'haiku', status: 'streaming', source: 'inline' },
    ]);
  });

  it('appendDelta appends text in order', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.appendDelta(KEY, id, 'Hel');
    store.appendDelta(KEY, id, 'lo ');
    store.appendDelta(KEY, id, 'world');
    expect(store.get(KEY).turns[0].answer).toBe('Hello world');
  });

  it('finish marks the turn done and records the session id', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.appendDelta(KEY, id, 'A');
    store.finish(KEY, id, 'sess-1');
    const thread = store.get(KEY);
    expect({ status: thread.turns[0].status, sessionId: thread.sessionId }).toEqual({
      status: 'done',
      sessionId: 'sess-1',
    });
  });

  it('stop keeps the partial answer and marks it stopped', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.appendDelta(KEY, id, 'partial');
    store.stop(KEY, id);
    const turn = store.get(KEY).turns[0];
    expect({ answer: turn.answer, status: turn.status }).toEqual({
      answer: 'partial',
      status: 'stopped',
    });
  });

  it('fail records kind and message and marks error', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.fail(KEY, id, 'rate-limited', 'slow down');
    const turn = store.get(KEY).turns[0];
    expect({ status: turn.status, error: turn.error }).toEqual({
      status: 'error',
      error: { kind: 'rate-limited', message: 'slow down' },
    });
  });

  it("stop and fail do not change the thread's sessionId", () => {
    const store = new ThreadStore();
    const first = askOne(store);
    store.finish(KEY, first, 'sess-1');
    const second = askOne(store, KEY, 'Follow-up');
    store.stop(KEY, second);
    const third = askOne(store, KEY, 'Another');
    store.fail(KEY, third, 'failed', 'boom');
    expect(store.get(KEY).sessionId).toBe('sess-1');
  });

  it('clear empties turns and forgets the session id', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.finish(KEY, id, 'sess-1');
    store.clear(KEY);
    expect(store.get(KEY)).toEqual({ key: KEY, turns: [] });
  });

  it('deltas for a turn removed by clear are ignored', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.clear(KEY);
    store.appendDelta(KEY, id, 'late');
    expect(store.get(KEY)).toEqual({ key: KEY, turns: [] });
  });

  it('deltas for a turn removed by clear do not notify', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.clear(KEY);
    const listener = vi.fn();
    store.subscribe(listener);
    store.appendDelta(KEY, id, 'late');
    expect(listener).not.toHaveBeenCalled();
  });

  it('events for an unknown turn id leave the thread unchanged', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.appendDelta(KEY, id, 'kept');
    const before = store.get(KEY);
    store.appendDelta(KEY, 'no-such-turn', 'x');
    store.finish(KEY, 'no-such-turn', 'sess-x');
    store.stop(KEY, 'no-such-turn');
    store.fail(KEY, 'no-such-turn', 'failed', 'x');
    expect(store.get(KEY)).toEqual(before);
  });

  it('events for an unknown turn id do not notify', () => {
    const store = new ThreadStore();
    askOne(store);
    const listener = vi.fn();
    store.subscribe(listener);
    store.appendDelta(KEY, 'no-such-turn', 'x');
    store.finish(KEY, 'no-such-turn', 'sess-x');
    store.stop(KEY, 'no-such-turn');
    store.fail(KEY, 'no-such-turn', 'failed', 'x');
    expect(listener).not.toHaveBeenCalled();
  });

  it('events for an unknown key do not notify', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    const listener = vi.fn();
    store.subscribe(listener);
    store.appendDelta(OTHER_KEY, id, 'x');
    store.finish(OTHER_KEY, id, 'sess-x');
    store.stop(OTHER_KEY, id);
    store.fail(OTHER_KEY, id, 'failed', 'x');
    expect(listener).not.toHaveBeenCalled();
  });

  it('threads with different keys are independent', () => {
    const store = new ThreadStore();
    const a = askOne(store, KEY, 'A?');
    askOne(store, OTHER_KEY, 'B?');
    store.appendDelta(KEY, a, 'answer A');
    store.finish(KEY, a, 'sess-a');
    store.clear(KEY);
    const other = store.get(OTHER_KEY);
    expect({ questions: other.turns.map((t) => t.question), answer: other.turns[0].answer }).toEqual({
      questions: ['B?'],
      answer: '',
    });
  });

  it('mutating a snapshot does not change the store', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.appendDelta(KEY, id, 'real');
    const snapshot = store.get(KEY);
    snapshot.turns[0].answer = 'tampered';
    snapshot.turns.push({
      id: 'fake',
      question: 'q',
      answer: '',
      model: 'opus',
      status: 'done',
      source: 'pane',
    });
    snapshot.sessionId = 'tampered';
    expect(store.get(KEY).turns).toEqual([
      { id, question: 'What is a kernel?', answer: 'real', model: 'sonnet', status: 'streaming', source: 'pane' },
    ]);
  });

  it('mutating a snapshot does not change the store session id', () => {
    const store = new ThreadStore();
    const id = askOne(store);
    store.finish(KEY, id, 'sess-1');
    store.get(KEY).sessionId = 'tampered';
    expect(store.get(KEY).sessionId).toBe('sess-1');
  });

  it('subscribers receive the key of each change', () => {
    const store = new ThreadStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const id = askOne(store, KEY);
    store.appendDelta(KEY, id, 'x');
    store.finish(KEY, id, 's');
    const id2 = askOne(store, OTHER_KEY);
    store.stop(OTHER_KEY, id2);
    const id3 = askOne(store, OTHER_KEY);
    store.fail(OTHER_KEY, id3, 'failed', 'm');
    store.clear(KEY);
    expect(listener.mock.calls.map((c) => c[0])).toEqual([
      KEY, KEY, KEY, OTHER_KEY, OTHER_KEY, OTHER_KEY, OTHER_KEY, KEY,
    ]);
  });

  it('unsubscribe stops notifications', () => {
    const store = new ThreadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    askOne(store);
    expect(listener).not.toHaveBeenCalled();
  });

  it('turn ids are unique across threads', () => {
    const store = new ThreadStore();
    const ids = [
      askOne(store, KEY),
      askOne(store, KEY),
      askOne(store, OTHER_KEY),
      askOne(store, OTHER_KEY),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

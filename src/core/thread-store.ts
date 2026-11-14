// Thread Store (pure, in-memory, never persisted). Behaviour lands in #4;
// importExchange (Continue in Pane) in #10.
import { notImplemented } from './not-implemented';
import type { ErrorKind, ModelAlias, Thread, ThreadKey, Turn } from './types';

export class ThreadStore {
  readonly #threads = new Map<ThreadKey, Thread>();
  readonly #listeners = new Set<(key: ThreadKey) => void>();
  #nextTurnId = 1;

  /** The Thread for `key`; empty if nothing was asked yet. Returns a deep copy. */
  get(key: ThreadKey): Thread {
    const thread = this.#threads.get(key);
    return thread ? structuredClone(thread) : { key, turns: [] };
  }

  /** Adds a streaming turn and returns its id. */
  appendQuestion(
    key: ThreadKey,
    question: string,
    model: ModelAlias,
    source: 'pane' | 'inline',
  ): string {
    let thread = this.#threads.get(key);
    if (!thread) {
      thread = { key, turns: [] };
      this.#threads.set(key, thread);
    }
    const id = `turn-${this.#nextTurnId++}`;
    thread.turns.push({ id, question, answer: '', model, status: 'streaming', source });
    this.#notify(key);
    return id;
  }

  appendDelta(key: ThreadKey, turnId: string, text: string): void {
    this.#update(key, turnId, (turn) => {
      turn.answer += text;
    });
  }

  finish(key: ThreadKey, turnId: string, sessionId: string): void {
    this.#update(key, turnId, (turn, thread) => {
      turn.status = 'done';
      thread.sessionId = sessionId;
    });
  }

  /** Marks the turn stopped, keeping the partial Answer. */
  stop(key: ThreadKey, turnId: string): void {
    this.#update(key, turnId, (turn) => {
      turn.status = 'stopped';
    });
  }

  fail(key: ThreadKey, turnId: string, kind: ErrorKind, message: string): void {
    this.#update(key, turnId, (turn) => {
      turn.status = 'error';
      turn.error = { kind, message };
    });
  }

  clear(key: ThreadKey): void {
    if (this.#threads.delete(key)) this.#notify(key);
  }

  /** Continue in Pane: brings an inline exchange into the Thread. */
  importExchange(
    key: ThreadKey,
    exchange: { question: string; answer: string; model: ModelAlias; sessionId?: string },
  ): void {
    void [key, exchange];
    notImplemented('ThreadStore.importExchange', '#10');
  }

  /** Returns the held prior exchange for `key` and forgets it (#10). */
  takePriorExchange(key: ThreadKey): { question: string; answer: string } | undefined {
    void key;
    return notImplemented('ThreadStore.takePriorExchange', '#10');
  }

  /** Calls `listener` with the key of every Thread that changes. */
  subscribe(listener: (key: ThreadKey) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Applies `change` to the turn and notifies; unknown key or turn is a silent no-op. */
  #update(key: ThreadKey, turnId: string, change: (turn: Turn, thread: Thread) => void): void {
    const thread = this.#threads.get(key);
    const turn = thread?.turns.find((t) => t.id === turnId);
    if (!thread || !turn) return;
    change(turn, thread);
    this.#notify(key);
  }

  #notify(key: ThreadKey): void {
    for (const listener of [...this.#listeners]) listener(key);
  }
}

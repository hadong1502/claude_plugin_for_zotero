// Thread Store (pure, in-memory, never persisted). Behaviour lands in #4;
// importExchange (Continue in Pane) and its one-shot prior context in #10.
import type { ErrorKind, ModelAlias, Thread, ThreadKey, Turn } from './types';

export class ThreadStore {
  readonly #threads = new Map<ThreadKey, Thread>();
  readonly #listeners = new Set<(key: ThreadKey) => void>();
  /** Continue in Pane exchanges held as one-shot prior context (#10). */
  readonly #prior = new Map<ThreadKey, { question: string; answer: string }>();
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
    this.#prior.delete(key);
    if (this.#threads.delete(key)) this.#notify(key);
  }

  /**
   * Continue in Pane (#10): appends the inline exchange as a done turn. An
   * empty Thread adopts the inline session id, so the next follow-up resumes
   * that CLI session; otherwise (or with no session id) the exchange is held as
   * prior context for the next question only.
   */
  importExchange(
    key: ThreadKey,
    exchange: { question: string; answer: string; model: ModelAlias; sessionId?: string },
  ): void {
    let thread = this.#threads.get(key);
    if (!thread) {
      thread = { key, turns: [] };
      this.#threads.set(key, thread);
    }
    const { question, answer, model, sessionId } = exchange;
    if (thread.turns.length === 0 && sessionId) {
      thread.sessionId = sessionId;
    } else {
      this.#prior.set(key, { question, answer });
    }
    const id = `turn-${this.#nextTurnId++}`;
    thread.turns.push({ id, question, answer, model, status: 'done', source: 'inline' });
    this.#notify(key);
  }

  /** Returns the held prior exchange for `key` and forgets it (#10). */
  takePriorExchange(key: ThreadKey): { question: string; answer: string } | undefined {
    const prior = this.#prior.get(key);
    this.#prior.delete(key);
    return prior;
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

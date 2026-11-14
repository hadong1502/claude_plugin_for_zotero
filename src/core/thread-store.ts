// Thread Store (pure, in-memory, never persisted). Behaviour lands in #4;
// importExchange (Continue in Pane) in #10.
import { notImplemented } from './not-implemented';
import type { ErrorKind, ModelAlias, Thread, ThreadKey } from './types';

export class ThreadStore {
  readonly #threads = new Map<ThreadKey, Thread>();

  /** The Thread for `key`; empty if nothing was asked yet. */
  get(key: ThreadKey): Thread {
    void [this.#threads, key];
    return notImplemented('ThreadStore.get', '#4');
  }

  /** Adds a streaming turn and returns its id. */
  appendQuestion(
    key: ThreadKey,
    question: string,
    model: ModelAlias,
    source: 'pane' | 'inline',
  ): string {
    void [key, question, model, source];
    return notImplemented('ThreadStore.appendQuestion', '#4');
  }

  appendDelta(key: ThreadKey, turnId: string, text: string): void {
    void [key, turnId, text];
    notImplemented('ThreadStore.appendDelta', '#4');
  }

  finish(key: ThreadKey, turnId: string, sessionId: string): void {
    void [key, turnId, sessionId];
    notImplemented('ThreadStore.finish', '#4');
  }

  /** Marks the turn stopped, keeping the partial Answer. */
  stop(key: ThreadKey, turnId: string): void {
    void [key, turnId];
    notImplemented('ThreadStore.stop', '#4');
  }

  fail(key: ThreadKey, turnId: string, kind: ErrorKind, message: string): void {
    void [key, turnId, kind, message];
    notImplemented('ThreadStore.fail', '#4');
  }

  clear(key: ThreadKey): void {
    void key;
    notImplemented('ThreadStore.clear', '#4');
  }

  /** Continue in Pane: brings an inline exchange into the Thread. */
  importExchange(
    key: ThreadKey,
    exchange: { question: string; answer: string; model: ModelAlias; sessionId?: string },
  ): void {
    void [key, exchange];
    notImplemented('ThreadStore.importExchange', '#10');
  }

  /** Calls `listener` with the key of every Thread that changes. */
  subscribe(listener: (key: ThreadKey) => void): () => void {
    void listener;
    return notImplemented('ThreadStore.subscribe', '#4');
  }
}

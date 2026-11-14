// Ask Controller (#4): drives one question at a time per Thread, mapping Claude
// Runner events onto the Thread Store. Clear and Stop cancel the run, and a
// run's events stop being applied once it has ended or been cleared, so late
// deltas never reach a cleared Thread (#4).
import { buildQuestion } from './context-builder';
import type { ThreadStore } from './thread-store';
import type {
  AnswerEvent,
  ClaudeRequest,
  ItemContext,
  ModelAlias,
  QuickAction,
  SelectionContext,
  ThreadKey,
} from './types';

/** Extra context for a question; the Inline Card passes `source: 'inline'` (#7). */
export interface AskOptions {
  quickAction?: QuickAction;
  selection?: SelectionContext;
  source?: 'pane' | 'inline';
}

export interface RunnerLike {
  ask(request: ClaudeRequest): AsyncIterable<AnswerEvent>;
  cancel(): void;
}

export interface AskControllerDeps {
  store: ThreadStore;
  /** null = no CLI found. */
  createRunner(): Promise<RunnerLike | null>;
  settings(): { aboutMe: string; answerLanguage: string };
}

interface Run {
  runner: RunnerLike | null;
  /** Cancel was requested (possibly before the runner existed). */
  cancelRequested: boolean;
  /** The Thread was cleared: ignore every later event of this run. */
  discarded: boolean;
}

export class AskController {
  readonly #deps: AskControllerDeps;
  readonly #runs = new Map<ThreadKey, Run>();

  constructor(deps: AskControllerDeps) {
    this.#deps = deps;
  }

  /** Resolves when the run ends. */
  async ask(
    key: ThreadKey,
    item: ItemContext,
    question: string,
    model: ModelAlias,
    options: AskOptions = {},
  ): Promise<void> {
    const text = question.trim();
    if (text === '' || this.#runs.has(key)) return;

    // Marked running synchronously, before any await.
    const run: Run = { runner: null, cancelRequested: false, discarded: false };
    this.#runs.set(key, run);
    const { store } = this.#deps;
    try {
      const turnId = store.appendQuestion(key, text, model, options.source ?? 'pane');
      const built = buildQuestion({
        item,
        question: text,
        quickAction: options.quickAction,
        selection: options.selection,
        paperContext: 'none',
        ...this.#deps.settings(),
      });
      const request: ClaudeRequest = {
        ...built,
        model,
        resumeSessionId: store.get(key).sessionId,
      };

      try {
        const runner = await this.#deps.createRunner();
        if (run.discarded) return;
        if (!runner) {
          store.fail(key, turnId, 'cli-not-found', '');
          return;
        }
        if (run.cancelRequested) {
          // Stopped before the runner existed: a runner ignores cancel() until
          // its stream is read, so never start it.
          store.stop(key, turnId);
          return;
        }
        run.runner = runner;

        for await (const event of runner.ask(request)) {
          if (run.discarded) return;
          if (this.#apply(key, turnId, event)) return;
        }
      } catch (err) {
        if (!run.discarded) store.fail(key, turnId, 'failed', String(err));
      }
    } finally {
      if (this.#runs.get(key) === run) this.#runs.delete(key);
    }
  }

  /** Applies one event; returns true when it ends the turn. */
  #apply(key: ThreadKey, turnId: string, event: AnswerEvent): boolean {
    const { store } = this.#deps;
    switch (event.type) {
      case 'started':
        return false;
      case 'delta':
        store.appendDelta(key, turnId, event.text);
        return false;
      case 'done':
        store.finish(key, turnId, event.sessionId);
        return true;
      case 'error':
        if (event.kind === 'cancelled') store.stop(key, turnId);
        else store.fail(key, turnId, event.kind, event.message);
        return true;
    }
  }

  stop(key: ThreadKey): void {
    this.#cancel(this.#runs.get(key));
  }

  /** Cancels any run, then clears the Thread. */
  clear(key: ThreadKey): void {
    const run = this.#runs.get(key);
    if (run) {
      run.discarded = true;
      this.#runs.delete(key);
      this.#cancel(run);
    }
    this.#deps.store.clear(key);
  }

  isRunning(key: ThreadKey): boolean {
    return this.#runs.has(key);
  }

  /** Shutdown. */
  cancelAll(): void {
    for (const run of this.#runs.values()) this.#cancel(run);
  }

  #cancel(run: Run | undefined): void {
    if (!run || run.cancelRequested) return;
    run.cancelRequested = true;
    run.runner?.cancel();
  }
}

// Ask Controller (#4): drives one question at a time per Thread, mapping Claude
// Runner events onto the Thread Store. Clear and Stop cancel the run, and a
// run's events stop being applied once it has ended or been cleared, so late
// deltas never reach a cleared Thread (#4).
import { buildQuestion } from './context-builder';
import { canReadPdfPath, resolvePaperContext } from './paper-context';
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

/** The paper behind the item: its PDF path and an extracted-text fallback (#8). */
export interface PaperSource {
  pdfPath?: string;
  loadText(): Promise<string | undefined>;
}

/** Extra context for a question; the Inline Card passes `source: 'inline'` (#7). */
export interface AskOptions {
  quickAction?: QuickAction;
  selection?: SelectionContext;
  source?: 'pane' | 'inline';
  /** The Paper Context toggle: always read the full paper (#8). */
  useFullPaper?: boolean;
  paper?: PaperSource;
}

export interface RunnerLike {
  ask(request: ClaudeRequest): AsyncIterable<AnswerEvent>;
  cancel(): void;
  /** Paths of Reads denied in the last run (#8). */
  deniedReads?(): string[];
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
  /** Settles when Stop or Clear hits this run; races a pending paper load (#8). */
  cancelSignal: Promise<void>;
  signalCancel(): void;
}

export class AskController {
  readonly #deps: AskControllerDeps;
  readonly #runs = new Map<ThreadKey, Run>();
  /** PDF paths whose Read was denied at runtime, normalised; kept for the controller's lifetime (#8). */
  readonly #deniedPdfs = new Set<string>();

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
    let signalCancel: () => void = () => {};
    const cancelSignal = new Promise<void>((resolve) => {
      signalCancel = resolve;
    });
    const run: Run = { runner: null, cancelRequested: false, discarded: false, cancelSignal, signalCancel };
    this.#runs.set(key, run);
    const { store } = this.#deps;
    try {
      const turnId = store.appendQuestion(key, text, model, options.source ?? 'pane');
      // Started before the paper is loaded so the runner is requested without delay.
      const runnerReady = this.#deps.createRunner();
      runnerReady.catch(() => {});
      const paperInput = await this.#choosePaper(options, text, run);
      // Stop or Clear during the paper load: nothing else is consumed or started.
      if (run.discarded) return;
      if (run.cancelRequested) {
        store.stop(key, turnId);
        return;
      }
      const built = buildQuestion({
        item,
        question: text,
        quickAction: options.quickAction,
        selection: options.selection,
        // Continue in Pane (#10): a held inline exchange goes with this question only.
        priorExchange: store.takePriorExchange(key),
        ...paperInput,
        ...this.#deps.settings(),
      });
      const request: ClaudeRequest = {
        ...built,
        model,
        resumeSessionId: store.get(key).sessionId,
      };

      try {
        const runner = await runnerReady;
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

        try {
          for await (const event of runner.ask(request)) {
            if (run.discarded) return;
            if (this.#apply(key, turnId, event)) return;
          }
        } finally {
          this.#rememberDenials(runner, request.readableFiles);
        }
      } catch (err) {
        if (!run.discarded) store.fail(key, turnId, 'failed', String(err));
      }
    } finally {
      if (this.#runs.get(key) === run) this.#runs.delete(key);
    }
  }

  /** Picks the Paper Context for a run and what it needs from the paper (#8). */
  async #choosePaper(
    options: AskOptions,
    question: string,
    run: Run,
  ): Promise<{ paperContext: 'none' | 'claude-decides' | 'forced'; pdfPath?: string; extractedText?: string }> {
    const paper = options.paper;
    const pdfPath = paper?.pdfPath;
    const mode = resolvePaperContext({
      useFullPaper: !!options.useFullPaper,
      question,
      hasPdf: pdfPath !== undefined,
    });
    if (mode === 'none' || !paper) return { paperContext: 'none' };
    if (pdfPath !== undefined && canReadPdfPath(pdfPath) && !this.#deniedPdfs.has(normalisePath(pdfPath))) {
      return { paperContext: mode, pdfPath };
    }
    if (mode !== 'forced') return { paperContext: 'none' };
    let text: string | undefined;
    try {
      // A load that never settles must not hold the run once Stop or Clear hits it.
      text = await Promise.race([paper.loadText(), run.cancelSignal.then(() => undefined)]);
    } catch {
      text = undefined;
    }
    return text?.trim() ? { paperContext: 'forced', extractedText: text } : { paperContext: 'none' };
  }

  #rememberDenials(runner: RunnerLike, readable: string[]): void {
    if (readable.length === 0) return;
    const denied = new Set((runner.deniedReads?.() ?? []).map(normalisePath));
    for (const path of readable) {
      const norm = normalisePath(path);
      if (denied.has(norm)) this.#deniedPdfs.add(norm);
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
    run.signalCancel();
    run.runner?.cancel();
  }
}

function normalisePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

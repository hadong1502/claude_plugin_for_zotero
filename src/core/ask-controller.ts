// Ask Controller (#4): drives one question at a time per Thread, mapping Claude
// Runner events onto the Thread Store. Behaviour lands in #4.
import { notImplemented } from './not-implemented';
import type { ThreadStore } from './thread-store';
import type {
  AnswerEvent,
  ClaudeRequest,
  ItemContext,
  ModelAlias,
  ThreadKey,
} from './types';

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

export class AskController {
  readonly #deps: AskControllerDeps;

  constructor(deps: AskControllerDeps) {
    this.#deps = deps;
  }

  /** Resolves when the run ends. */
  ask(key: ThreadKey, item: ItemContext, question: string, model: ModelAlias): Promise<void> {
    void [this.#deps, key, item, question, model];
    return notImplemented('AskController.ask', '#4');
  }

  stop(key: ThreadKey): void {
    void key;
    notImplemented('AskController.stop', '#4');
  }

  /** Cancels any run, then clears the Thread. */
  clear(key: ThreadKey): void {
    void key;
    notImplemented('AskController.clear', '#4');
  }

  isRunning(key: ThreadKey): boolean {
    void key;
    return notImplemented('AskController.isRunning', '#4');
  }

  /** Shutdown. */
  cancelAll(): void {
    notImplemented('AskController.cancelAll', '#4');
  }
}

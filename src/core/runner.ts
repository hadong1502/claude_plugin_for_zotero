// Claude Runner: runs one question through the local Claude Code CLI and
// yields the Answer as a stream of events. Behaviour lands in #4 (and in #8
// for the tool and permission flags).
import { notImplemented } from './not-implemented';
import type { ProcessPort } from './process-port';
import type { AnswerEvent, ClaudeRequest } from './types';

export class ClaudeRunner {
  readonly #port: ProcessPort;
  readonly #config: { cliPath: string; workdir: string };

  constructor(port: ProcessPort, config: { cliPath: string; workdir: string }) {
    this.#port = port;
    this.#config = config;
  }

  /** Runs the request and yields `started`, `delta`s, then `done` or `error`. */
  ask(request: ClaudeRequest): AsyncIterable<AnswerEvent> {
    void [this.#port, this.#config, request];
    return notImplemented('ClaudeRunner.ask', '#4');
  }

  /** Stops the running question, if any; its stream ends with `cancelled`. */
  cancel(): void {
    notImplemented('ClaudeRunner.cancel', '#4');
  }
}

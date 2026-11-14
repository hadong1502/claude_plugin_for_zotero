// Claude Runner: runs one question through the local Claude Code CLI and
// yields the Answer as a stream of events (#4). The tool and permission flags
// land in #8.
import { buildCliArgs, buildStdinMessage } from './cli-invocation';
import { classifyFailure } from './failure';
import { ProcessNotFoundError, type ProcessPort, type RunningProcess } from './process-port';
import { StreamJsonParser, type ParsedEvent } from './stream-parser';
import type { AnswerEvent, ClaudeRequest } from './types';

const CANCELLED = Symbol('cancelled');

export class ClaudeRunner {
  readonly #port: ProcessPort;
  readonly #config: { cliPath: string; workdir: string };
  #running = false;
  #cancelled = false;
  #process: RunningProcess | undefined;
  #signalCancel: () => void = () => {};

  constructor(port: ProcessPort, config: { cliPath: string; workdir: string }) {
    this.#port = port;
    this.#config = config;
  }

  /** Runs the request and yields `started`, `delta`s, then `done` or `error`. */
  ask(request: ClaudeRequest): AsyncIterable<AnswerEvent> {
    return this.#run(request);
  }

  /** Stops the running question, if any; its stream ends with `cancelled`. */
  cancel(): void {
    if (!this.#running || this.#cancelled) return;
    this.#cancelled = true;
    this.#process?.kill();
    this.#signalCancel();
  }

  async *#run(request: ClaudeRequest): AsyncGenerator<AnswerEvent> {
    if (this.#running) {
      yield { type: 'error', kind: 'failed', message: 'Runner is busy' };
      return;
    }
    this.#running = true;
    this.#cancelled = false;
    const cancelSignal = new Promise<typeof CANCELLED>((resolve) => {
      this.#signalCancel = () => resolve(CANCELLED);
    });
    let proc: RunningProcess | undefined;
    let finished = false;
    try {
      const { cliPath, workdir } = this.#config;
      if (cliPath === '') {
        yield { type: 'error', kind: 'cli-not-found', message: '' };
        return;
      }
      try {
        proc = await this.#port.spawn({ command: cliPath, args: buildCliArgs(request), workdir });
      } catch (err) {
        if (err instanceof ProcessNotFoundError) {
          yield { type: 'error', kind: 'cli-not-found', message: cliPath };
          return;
        }
        yield { type: 'error', kind: 'failed', message: err instanceof Error ? err.message : String(err) };
        return;
      }
      this.#process = proc;
      if (this.#cancelled) proc.kill();

      // A write failure (e.g. the CLI already exited) shows up as exit evidence below.
      try {
        await proc.writeStdin(buildStdinMessage(request.content));
        await proc.closeStdin();
      } catch {
        /* classified from the exit code and stderr */
      }

      const parser = new StreamJsonParser();
      const deltas: string[] = [];
      let initId: string | undefined;
      let started = false;
      let assistantErrorCode: string | undefined;
      let result: Extract<ParsedEvent, { kind: 'result' }> | undefined;

      const read = (): Promise<string | typeof CANCELLED> => Promise.race([proc!.readStdout(), cancelSignal]);

      outer: while (true) {
        const chunk = await read();
        if (chunk === CANCELLED || this.#cancelled) break;
        const events = chunk === '' ? parser.end() : parser.push(chunk);
        for (const event of events) {
          if (event.kind === 'session') {
            initId = event.sessionId;
            if (!started) {
              started = true;
              yield { type: 'started', sessionId: event.sessionId };
            }
          } else if (event.kind === 'text') {
            deltas.push(event.text);
            yield { type: 'delta', text: event.text };
          } else if (event.kind === 'assistant-error') {
            assistantErrorCode = event.code;
          } else {
            result = event;
            break outer;
          }
        }
        if (this.#cancelled) break;
        if (chunk === '') break;
      }

      if (this.#cancelled) {
        finished = true;
        yield { type: 'error', kind: 'cancelled', message: '' };
        return;
      }

      if (result && !result.isError) {
        finished = true;
        const text = deltas.length > 0 ? deltas.join('') : result.text;
        const sessionId = result.sessionId ?? initId ?? '';
        void drain(proc);
        yield { type: 'done', text, sessionId };
        return;
      }

      // Failure: let the process finish, then classify from everything it said.
      if (result) {
        // Drain the rest of stdout so the process can exit.
        while (true) {
          const rest = await read();
          if (rest === CANCELLED || rest === '') break;
        }
      }
      let stderr = '';
      const readStderrFully = async () => {
        while (true) {
          const part = await proc!.readStderr();
          if (part === '') break;
          stderr += part;
        }
      };
      const exit = await Promise.race([
        (async () => {
          await readStderrFully();
          return proc!.wait();
        })(),
        cancelSignal,
      ]);
      finished = true;
      if (exit === CANCELLED || this.#cancelled) {
        yield { type: 'error', kind: 'cancelled', message: '' };
        return;
      }
      const failure = classifyFailure({
        assistantErrorCode,
        resultText: result?.text,
        resultErrors: result?.errors ?? [],
        stderr,
        exitCode: exit.exitCode,
      });
      yield { type: 'error', kind: failure.kind, message: failure.message };
    } finally {
      // A consumer that stops early must not leave the CLI running.
      if (proc && !finished) proc.kill();
      this.#running = false;
      this.#process = undefined;
    }
  }
}

/** Reads the process to its end in the background; never rejects. */
async function drain(proc: RunningProcess): Promise<void> {
  try {
    const drainStream = async (read: () => Promise<string>) => {
      while ((await read()) !== '') {
        /* discard */
      }
    };
    await Promise.all([drainStream(() => proc.readStdout()), drainStream(() => proc.readStderr())]);
    await proc.wait();
  } catch {
    /* the answer is already delivered */
  }
}

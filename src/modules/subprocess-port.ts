// Production Process Port (#4): spawns the Claude CLI with Firefox's
// Subprocess.sys.mjs.
//
// - The child gets the current environment minus the variables that make the
//   CLI behave as a nested session (childEnvironment).
// - Output is read as bytes and decoded with one streaming TextDecoder per
//   pipe, so a UTF-8 character split across reads survives. InputPipe's own
//   readString() also decodes in streaming mode, but it resolves '' for a read
//   that holds only the first bytes of a character, and the Claude Runner reads
//   '' as end of stream.
// - stderr is drained into a buffer from spawn time, so a chatty CLI cannot
//   block on a full stderr pipe while the Runner is still reading stdout.
// - After kill(), every read resolves ''.
import { childEnvironment } from '../core/cli-invocation';
import { foldEmptyOptionValues } from '../core/process-args';
import { ProcessNotFoundError, type ProcessPort, type RunningProcess } from '../core/process-port';

interface InputPipe {
  /** The first chunk to become available; an empty buffer at end of file. */
  read(): Promise<ArrayBuffer>;
}

interface OutputPipe {
  write(data: string): Promise<unknown>;
  close(): Promise<unknown>;
}

interface SubprocessProcess {
  stdin: OutputPipe;
  stdout: InputPipe;
  stderr: InputPipe;
  kill(): Promise<unknown>;
  wait(): Promise<{ exitCode: number }>;
}

interface SubprocessModule {
  Subprocess: {
    ERROR_BAD_EXECUTABLE: number;
    getEnvironment(): Record<string, string>;
    call(options: {
      command: string;
      arguments: string[];
      workdir: string;
      environment: Record<string, string>;
      environmentAppend: boolean;
      stderr: 'pipe';
    }): Promise<SubprocessProcess>;
  };
}

export function createSubprocessPort(): ProcessPort {
  return {
    async spawn({ command, args, workdir }) {
      const { Subprocess } = ChromeUtils.importESModule(
        'resource://gre/modules/Subprocess.sys.mjs',
      ) as SubprocessModule;
      let proc: SubprocessProcess;
      try {
        proc = await Subprocess.call({
          command,
          arguments: foldEmptyOptionValues(args),
          workdir,
          environment: childEnvironment(Subprocess.getEnvironment()),
          environmentAppend: false,
          stderr: 'pipe',
        });
      } catch (e) {
        // Subprocess.call checks the command before spawning: a path that is
        // missing, relative, a directory or a link fails with this code.
        if ((e as { errorCode?: unknown } | null)?.errorCode === Subprocess.ERROR_BAD_EXECUTABLE) {
          throw new ProcessNotFoundError((e as Error).message);
        }
        throw e;
      }
      return new SubprocessRunningProcess(proc);
    },
  };
}

/** Decoded text chunks of one pipe; '' only at end of file. */
class PipeText {
  readonly #pipe: InputPipe;
  readonly #decoder = new TextDecoder('utf-8');
  #ended = false;

  constructor(pipe: InputPipe) {
    this.#pipe = pipe;
  }

  async next(): Promise<string> {
    while (!this.#ended) {
      const bytes = await this.#pipe.read();
      if (bytes.byteLength === 0) {
        this.#ended = true;
        return this.#decoder.decode();
      }
      const text = this.#decoder.decode(new Uint8Array(bytes), { stream: true });
      if (text !== '') return text;
    }
    return '';
  }
}

class SubprocessRunningProcess implements RunningProcess {
  readonly #proc: SubprocessProcess;
  readonly #stdout: PipeText;
  #killed = false;
  #onKill: () => void = () => {};
  readonly #killedSignal = new Promise<''>((resolve) => {
    this.#onKill = () => resolve('');
  });
  #stderrBuffer = '';
  #stderrEnded = false;
  #stderrWaiters: Array<() => void> = [];

  constructor(proc: SubprocessProcess) {
    this.#proc = proc;
    this.#stdout = new PipeText(proc.stdout);
    void this.#drainStderr(new PipeText(proc.stderr));
  }

  writeStdin(text: string): Promise<void> {
    return this.#proc.stdin.write(text).then(() => undefined);
  }

  closeStdin(): Promise<void> {
    return this.#proc.stdin.close().then(() => undefined);
  }

  readStdout(): Promise<string> {
    if (this.#killed) return Promise.resolve('');
    const read = this.#stdout.next().catch((e: unknown) => {
      if (this.#killed) return '';
      throw e;
    });
    return Promise.race([read, this.#killedSignal]);
  }

  async readStderr(): Promise<string> {
    while (!this.#killed) {
      if (this.#stderrBuffer !== '') {
        const text = this.#stderrBuffer;
        this.#stderrBuffer = '';
        return text;
      }
      if (this.#stderrEnded) return '';
      await new Promise<void>((resolve) => {
        this.#stderrWaiters.push(resolve);
      });
    }
    return '';
  }

  kill(): void {
    if (this.#killed) return;
    this.#killed = true;
    this.#onKill();
    this.#wakeStderrReader();
    this.#proc.kill().catch(() => {
      /* already exited */
    });
  }

  wait(): Promise<{ exitCode: number }> {
    return this.#proc.wait().then(({ exitCode }) => ({ exitCode }));
  }

  async #drainStderr(pipe: PipeText): Promise<void> {
    try {
      while (true) {
        const text = await pipe.next();
        if (text === '') break;
        this.#stderrBuffer += text;
        this.#wakeStderrReader();
      }
    } catch {
      /* a broken stderr pipe ends it; the exit code still classifies the run */
    }
    this.#stderrEnded = true;
    this.#wakeStderrReader();
  }

  #wakeStderrReader(): void {
    for (const wake of this.#stderrWaiters.splice(0)) wake();
  }
}

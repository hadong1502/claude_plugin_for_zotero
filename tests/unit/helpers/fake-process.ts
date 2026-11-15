// Fake Process Port for the Claude Runner's tests (#4). It stands in for the OS
// process, the system boundary: it replays recorded CLI stdout and records what
// the Runner spawned, wrote and killed.
import {
  ProcessNotFoundError,
  type ProcessPort,
  type RunningProcess,
} from '../../../src/core/process-port';

export interface FakePortOptions {
  /** Text of the stderr stream (default empty). */
  stderr?: string;
  /** Exit code `wait()` resolves with (default 0). */
  exitCode?: number;
  /** Characters per chunk for stdout and stderr (default: everything in one chunk). */
  chunkSize?: number;
  /** `spawn` rejects with ProcessNotFoundError. */
  notFound?: boolean;
  /** stdout stops after this many characters and stays pending until `kill()`, then ends. */
  hangAfterBytes?: number;
  /** `readStdout` rejects with this message instead of returning data. */
  readError?: string;
  /** `wait()` rejects with this message. */
  waitError?: string;
}

export interface FakePort {
  port: ProcessPort;
  spawned: Array<{ command: string; args: string[]; workdir: string }>;
  stdinWrites: string[];
  stdinClosed(): boolean;
  killed(): boolean;
}

function chunks(text: string, size: number | undefined): string[] {
  if (text === '') return [];
  if (!size) return [text];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/** Reads successive chunks, then `''` at end of stream (after `hangAtEnd`, if given). */
function reader(parts: string[], hangAtEnd: Promise<void> | undefined, onEof: () => void) {
  let index = 0;
  return async (): Promise<string> => {
    if (index < parts.length) return parts[index++];
    if (hangAtEnd) await hangAtEnd;
    onEof();
    return '';
  };
}

export function fakePort(stdout: string, opts: FakePortOptions = {}): FakePort {
  const spawned: FakePort['spawned'] = [];
  const stdinWrites: string[] = [];
  let stdinClosed = false;
  let killed = false;

  const hanging = opts.hangAfterBytes !== undefined;
  const stdoutText = hanging ? stdout.slice(0, opts.hangAfterBytes) : stdout;

  const port: ProcessPort = {
    async spawn(spawnOpts) {
      spawned.push({ ...spawnOpts, args: [...spawnOpts.args] });
      if (opts.notFound) throw new ProcessNotFoundError(spawnOpts.command);

      let releaseHang: () => void = () => {};
      const hang = hanging ? new Promise<void>((resolve) => (releaseHang = resolve)) : undefined;
      let releaseEnded: () => void = () => {};
      const ended = new Promise<void>((resolve) => (releaseEnded = resolve));

      const running: RunningProcess = {
        async writeStdin(text) {
          stdinWrites.push(text);
        },
        async closeStdin() {
          stdinClosed = true;
        },
        readStdout:
          opts.readError !== undefined
            ? async () => {
                throw new Error(opts.readError);
              }
            : reader(chunks(stdoutText, opts.chunkSize), hang, releaseEnded),
        readStderr: reader(chunks(opts.stderr ?? '', opts.chunkSize), undefined, () => {}),
        kill() {
          killed = true;
          releaseHang();
          releaseEnded();
        },
        async wait() {
          if (opts.waitError !== undefined) throw new Error(opts.waitError);
          await ended;
          return { exitCode: opts.exitCode ?? 0 };
        },
      };
      return running;
    },
  };

  return { port, spawned, stdinWrites, stdinClosed: () => stdinClosed, killed: () => killed };
}

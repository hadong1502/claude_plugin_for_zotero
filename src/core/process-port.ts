// Process Port: the small seam through which the Claude Runner spawns the CLI.
// Production adapter: Firefox's Subprocess.sys.mjs (#4). Tests use a fake.

/** A spawned process. */
export interface RunningProcess {
  writeStdin(text: string): Promise<void>;
  closeStdin(): Promise<void>;
  /** Next stdout chunk; resolves `''` at end of stream. */
  readStdout(): Promise<string>;
  /** Next stderr chunk; resolves `''` at end of stream. */
  readStderr(): Promise<string>;
  kill(): void;
  wait(): Promise<{ exitCode: number }>;
}

export interface ProcessPort {
  /** Rejects with ProcessNotFoundError when the executable does not exist. */
  spawn(opts: { command: string; args: string[]; workdir: string }): Promise<RunningProcess>;
}

/** What `ProcessPort.spawn` rejects with when the executable does not exist. */
export class ProcessNotFoundError extends Error {
  constructor(message = 'Executable not found') {
    super(message);
    this.name = 'ProcessNotFoundError';
  }
}

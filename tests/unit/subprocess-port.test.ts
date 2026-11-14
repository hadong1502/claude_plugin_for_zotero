// Subprocess-backed Process Port (#4). Firefox's Subprocess module is the
// system boundary, so ChromeUtils.importESModule is stubbed with a fake whose
// pipes hand out raw bytes the way InputPipe.read() does.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProcessNotFoundError } from '../../src/core/process-port';
import { createSubprocessPort } from '../../src/modules/subprocess-port';

const ERROR_BAD_EXECUTABLE = 0xff7a0003;

/** A pipe that resolves queued byte chunks, then an empty buffer at end of file. */
function fakeInputPipe() {
  const queue: ArrayBuffer[] = [];
  const waiting: Array<(buffer: ArrayBuffer) => void> = [];
  let ended = false;
  const deliver = (buffer: ArrayBuffer) => {
    const next = waiting.shift();
    if (next) next(buffer);
    else queue.push(buffer);
  };
  return {
    pipe: {
      read: (): Promise<ArrayBuffer> =>
        new Promise((resolve) => {
          const buffer = queue.shift();
          if (buffer) resolve(buffer);
          else if (ended) resolve(new ArrayBuffer(0));
          else waiting.push(resolve);
        }),
    },
    push(bytes: number[]) {
      deliver(new Uint8Array(bytes).buffer);
    },
    end() {
      ended = true;
      for (const resolve of waiting.splice(0)) resolve(new ArrayBuffer(0));
    },
  };
}

function utf8(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

function stubSubprocess(opts: { callError?: unknown; env?: Record<string, string> } = {}) {
  const stdout = fakeInputPipe();
  const stderr = fakeInputPipe();
  const stdinWrites: string[] = [];
  const kill = vi.fn(async () => ({ exitCode: -9 }));
  const call = vi.fn(async (_options: Record<string, unknown>) => {
    if (opts.callError) throw opts.callError;
    return {
      stdin: {
        write: async (text: string) => {
          stdinWrites.push(text);
          return { bytesWritten: text.length };
        },
        close: async () => ({}),
      },
      stdout: stdout.pipe,
      stderr: stderr.pipe,
      kill,
      wait: async () => ({ exitCode: 3 }),
    };
  });
  vi.stubGlobal('ChromeUtils', {
    importESModule: (url: string) => {
      expect(url).toBe('resource://gre/modules/Subprocess.sys.mjs');
      return {
        Subprocess: {
          ERROR_BAD_EXECUTABLE,
          getEnvironment: () => ({ ...(opts.env ?? { PATH: 'C:\\bin' }) }),
          call,
        },
      };
    },
  });
  return { stdout, stderr, stdinWrites, kill, call };
}

async function spawn() {
  return createSubprocessPort().spawn({
    command: 'C:\\claude.exe',
    args: ['-p', '--setting-sources', '', '--tools', ''],
    workdir: 'C:\\data\\claude-for-zotero\\cli-workdir',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSubprocessPort', () => {
  it('spawns with the workdir, piped stderr, empty values as --name= and only the child environment', async () => {
    const fake = stubSubprocess({
      env: { PATH: 'C:\\bin', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_EFFORT: 'high' },
    });
    await spawn();
    expect(fake.call.mock.calls[0][0]).toEqual({
      command: 'C:\\claude.exe',
      arguments: ['-p', '--setting-sources=', '--tools='],
      workdir: 'C:\\data\\claude-for-zotero\\cli-workdir',
      environment: { PATH: 'C:\\bin' },
      environmentAppend: false,
      stderr: 'pipe',
    });
  });

  it('rejects with ProcessNotFoundError when Subprocess reports a bad executable', async () => {
    const error = Object.assign(new Error('File at path "C:\\claude.exe" does not exist, or is not executable'), {
      errorCode: ERROR_BAD_EXECUTABLE,
    });
    stubSubprocess({ callError: error });
    await expect(spawn()).rejects.toBeInstanceOf(ProcessNotFoundError);
  });

  it('passes any other spawn failure through', async () => {
    stubSubprocess({ callError: new Error('Failed to create process') });
    const rejection = spawn();
    await expect(rejection).rejects.not.toBeInstanceOf(ProcessNotFoundError);
    await expect(rejection).rejects.toThrow('Failed to create process');
  });

  it('decodes UTF-8 split across reads, never returning "" before end of file', async () => {
    const fake = stubSubprocess();
    const proc = await spawn();
    for (const byte of utf8('aλ漢')) fake.stdout.push([byte]);
    fake.stdout.end();
    const chunks: string[] = [];
    for (let chunk = await proc.readStdout(); chunk !== ''; chunk = await proc.readStdout()) chunks.push(chunk);
    expect(chunks.join('')).toBe('aλ漢');
    expect(chunks).not.toContain('');
  });

  it('writes stdin as text', async () => {
    const fake = stubSubprocess();
    const proc = await spawn();
    await proc.writeStdin('{"q":"λ"}\n');
    await proc.closeStdin();
    expect(fake.stdinWrites).toEqual(['{"q":"λ"}\n']);
  });

  it('collects stderr while stdout is still being read', async () => {
    const fake = stubSubprocess();
    const proc = await spawn();
    fake.stderr.push(utf8('warn 1\n'));
    fake.stderr.push(utf8('warn 2\n'));
    fake.stderr.end();
    fake.stdout.push(utf8('out'));
    fake.stdout.end();
    expect(await proc.readStdout()).toBe('out');
    expect(await proc.readStdout()).toBe('');
    let stderr = '';
    for (let chunk = await proc.readStderr(); chunk !== ''; chunk = await proc.readStderr()) stderr += chunk;
    expect(stderr).toBe('warn 1\nwarn 2\n');
  });

  it('resolves pending and later reads with "" after kill, and kills the process', async () => {
    const fake = stubSubprocess();
    const proc = await spawn();
    const pendingOut = proc.readStdout();
    const pendingErr = proc.readStderr();
    proc.kill();
    expect(await pendingOut).toBe('');
    expect(await pendingErr).toBe('');
    expect(await proc.readStdout()).toBe('');
    expect(await proc.readStderr()).toBe('');
    expect(fake.kill).toHaveBeenCalledTimes(1);
  });

  it('reports the exit code from wait()', async () => {
    stubSubprocess();
    const proc = await spawn();
    expect(await proc.wait()).toEqual({ exitCode: 3 });
  });
});

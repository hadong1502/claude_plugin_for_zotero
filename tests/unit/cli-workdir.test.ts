// The CLI working directory (#4): `<Zotero data dir>/claude-for-zotero/cli-workdir`,
// created if missing. PathUtils, IOUtils and the data directory are the
// boundary, so they are faked.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensureCliWorkdir } from '../../src/modules/cli-workdir';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ensureCliWorkdir', () => {
  it('creates <data dir>/claude-for-zotero/cli-workdir and returns its path', async () => {
    const makeDirectory = vi.fn(async () => {});
    vi.stubGlobal('Zotero', { DataDirectory: { dir: 'C:\\Users\\u\\Zotero' } });
    vi.stubGlobal('PathUtils', { join: (...parts: string[]) => parts.join('\\') });
    vi.stubGlobal('IOUtils', { makeDirectory });

    const dir = await ensureCliWorkdir();

    expect(dir).toBe('C:\\Users\\u\\Zotero\\claude-for-zotero\\cli-workdir');
    expect(makeDirectory).toHaveBeenCalledWith(dir, { createAncestors: true, ignoreExisting: true });
  });
});

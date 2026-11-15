// Zotero-side CLI locator (#5): supplies the real dependencies of
// resolveCliPath (Subprocess.pathSearch, IOUtils.exists, the home directory)
// and reads the cliPath override preference. The Gecko globals are the
// boundary, so they are faked here.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectCliPathInZotero, getCliPath } from '../../src/modules/cli-locator';
import { PREF_KEYS } from '../../src/core/prefs-schema';

/** Windows path written with forward slashes for readability. */
const win = (path: string) => path.replace(/\//g, '\\');

interface FakeGecko {
  isWin?: boolean;
  home?: string;
  override?: string;
  pathSearch?: (name: string) => Promise<string>;
  existing?: string[];
  existsThrows?: boolean;
}

function stubGecko({
  isWin = true,
  home = win('C:/Users/u'),
  override,
  pathSearch = async () => {
    throw new Error('Executable not found: claude');
  },
  existing = [],
  existsThrows = false,
}: FakeGecko = {}) {
  const existsCalls: string[] = [];
  const pathSearchSpy = vi.fn(pathSearch);
  const prefs = new Map<string, string>();
  if (override !== undefined) prefs.set(PREF_KEYS.cliPath, override);
  vi.stubGlobal('Zotero', {
    isWin,
    Prefs: { get: (key: string, global?: boolean) => (global ? prefs.get(key) : undefined) },
  });
  vi.stubGlobal('ChromeUtils', {
    importESModule: (uri: string) => {
      if (uri !== 'resource://gre/modules/Subprocess.sys.mjs') throw new Error(`unexpected module ${uri}`);
      return { Subprocess: { pathSearch: pathSearchSpy } };
    },
  });
  vi.stubGlobal('IOUtils', {
    exists: async (path: string) => {
      existsCalls.push(path);
      if (existsThrows) throw new Error('NS_ERROR_FILE_UNRECOGNIZED_PATH');
      return existing.includes(path);
    },
  });
  vi.stubGlobal('Components', { interfaces: { nsIFile: 'nsIFile' } });
  vi.stubGlobal('Services', {
    dirsvc: {
      get: (key: string) => {
        if (key !== 'Home') throw new Error(`unexpected directory ${key}`);
        return { path: home };
      },
    },
  });
  return { existsCalls, pathSearchSpy };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CLI locator (src/modules/cli-locator)', () => {
  it('getCliPath returns the trimmed cliPath override without searching', async () => {
    const { pathSearchSpy, existsCalls } = stubGecko({ override: `  ${win('D:/tools/claude.exe')} ` });
    expect(await getCliPath()).toBe(win('D:/tools/claude.exe'));
    expect(pathSearchSpy).not.toHaveBeenCalled();
    expect(existsCalls).toEqual([]);
  });

  it('getCliPath returns the PATH search result when there is no override', async () => {
    const { pathSearchSpy } = stubGecko({ pathSearch: async () => win('C:/bin/claude.exe') });
    expect(await getCliPath()).toBe(win('C:/bin/claude.exe'));
    expect(pathSearchSpy).toHaveBeenCalledWith('claude');
  });

  it('treats a rejected Subprocess.pathSearch as not found and uses the home-directory fallback', async () => {
    const { existsCalls } = stubGecko({ existing: [win('C:/Users/u/.local/bin/claude.exe')] });
    expect(await getCliPath()).toBe(win('C:/Users/u/.local/bin/claude.exe'));
    expect(existsCalls).toEqual([win('C:/Users/u/.local/bin/claude.exe')]);
  });

  it('keeps forward slashes outside Windows', async () => {
    const { existsCalls } = stubGecko({
      isWin: false,
      home: '/home/u',
      existing: ['/home/u/.local/bin/claude.exe'],
    });
    expect(await getCliPath()).toBe('/home/u/.local/bin/claude.exe');
    expect(existsCalls).toEqual(['/home/u/.local/bin/claude.exe']);
  });

  it('returns null when nothing is found', async () => {
    stubGecko();
    expect(await getCliPath()).toBeNull();
  });

  it('treats an IOUtils.exists failure as a missing fallback', async () => {
    stubGecko({ existsThrows: true });
    expect(await getCliPath()).toBeNull();
  });

  it('detectCliPathInZotero ignores the override', async () => {
    stubGecko({ override: win('D:/tools/claude.exe'), pathSearch: async () => win('C:/bin/claude.exe') });
    expect(await detectCliPathInZotero()).toBe(win('C:/bin/claude.exe'));
  });
});

// Only a .exe is spawned on Windows (#1, final review): a .cmd or .bat runs
// through cmd.exe, which can turn a `&` in a PDF file name into a command.
describe('CLI locator, .exe only on Windows (src/modules/cli-locator)', () => {
  it('getCliPath returns null for a .cmd override on Windows, so the question fails with cli-not-found', async () => {
    const { pathSearchSpy } = stubGecko({
      override: win('C:/Users/u/AppData/Roaming/npm/claude.cmd'),
      pathSearch: async () => win('C:/bin/claude.exe'),
    });
    expect(await getCliPath()).toBeNull();
    expect(pathSearchSpy).not.toHaveBeenCalled();
  });

  it('getCliPath keeps a non-.exe override outside Windows', async () => {
    stubGecko({ isWin: false, home: '/home/u', override: '/usr/local/bin/claude' });
    expect(await getCliPath()).toBe('/usr/local/bin/claude');
  });

  it('auto-detection skips an npm shim on PATH and finds claude.exe', async () => {
    const shims: Record<string, string> = {
      claude: win('C:/Users/u/AppData/Roaming/npm/claude'),
      'claude.exe': win('C:/Users/u/.local/bin/claude.exe'),
    };
    const { pathSearchSpy } = stubGecko({ pathSearch: async (name) => shims[name] });
    expect(await detectCliPathInZotero()).toBe(win('C:/Users/u/.local/bin/claude.exe'));
    expect(pathSearchSpy.mock.calls.map(([name]) => name)).toEqual(['claude', 'claude.exe']);
  });
});

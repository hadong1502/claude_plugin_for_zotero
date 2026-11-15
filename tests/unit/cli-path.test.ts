// CLI path resolution (#5): the Claude CLI path is auto-detected with an
// override field (#1, user story 47; #1 Implementation Decisions, Preferences:
// Subprocess.pathSearch("claude") with a fallback to ~/.local/bin/claude.exe).
// pathSearch and fileExists are the process-environment and filesystem
// boundaries, so they are faked here.
import { describe, expect, it } from 'vitest';

import { resolveCliPath, type CliPathDeps } from '../../src/core/cli-path';

const HOME = 'C:/Users/u';
const FALLBACK = 'C:/Users/u/.local/bin/claude.exe';
const PATH_HIT = 'C:/bin/claude.exe';
const OVERRIDE = 'C:/x/claude.exe';

interface FakeOptions {
  pathResult?: string | null;
  pathThrows?: boolean;
  existing?: string[];
}

function fakeDeps({ pathResult = null, pathThrows = false, existing = [] }: FakeOptions = {}) {
  const pathSearchCalls: string[] = [];
  const fileExistsCalls: string[] = [];
  const deps: CliPathDeps = {
    pathSearch: async (name) => {
      pathSearchCalls.push(name);
      if (pathThrows) throw new Error('PATH search failed');
      return pathResult;
    },
    fileExists: async (path) => {
      fileExistsCalls.push(path);
      return existing.includes(path);
    },
    homeDir: HOME,
  };
  return { deps, pathSearchCalls, fileExistsCalls };
}

describe('resolveCliPath (src/core/cli-path)', () => {
  it('returns the override even when PATH and the fallback would both succeed', async () => {
    const { deps } = fakeDeps({ pathResult: PATH_HIT, existing: [FALLBACK] });
    expect(await resolveCliPath(OVERRIDE, deps)).toBe(OVERRIDE);
  });

  it('trims surrounding whitespace from the override', async () => {
    const { deps } = fakeDeps({ pathResult: PATH_HIT, existing: [FALLBACK] });
    expect(await resolveCliPath('  C:/x/claude.exe  ', deps)).toBe(OVERRIDE);
  });

  it('treats a whitespace-only override as empty and uses the PATH result', async () => {
    const { deps } = fakeDeps({ pathResult: PATH_HIT });
    expect(await resolveCliPath('   ', deps)).toBe(PATH_HIT);
  });

  it('returns the PATH result when there is no override', async () => {
    const { deps } = fakeDeps({ pathResult: PATH_HIT, existing: [FALLBACK] });
    expect(await resolveCliPath('', deps)).toBe(PATH_HIT);
  });

  it('searches PATH for the name claude', async () => {
    const { deps, pathSearchCalls } = fakeDeps({ pathResult: PATH_HIT });
    await resolveCliPath('', deps);
    expect(pathSearchCalls).toEqual(['claude']);
  });

  it('returns the fallback under the home directory when PATH misses and the fallback exists', async () => {
    const { deps } = fakeDeps({ existing: [FALLBACK] });
    expect(await resolveCliPath('', deps)).toBe(FALLBACK);
  });

  it('checks exactly <homeDir>/.local/bin/claude.exe for the fallback', async () => {
    const { deps, fileExistsCalls } = fakeDeps();
    await resolveCliPath('', deps);
    expect(fileExistsCalls).toEqual([FALLBACK]);
  });

  it('returns null when PATH misses and the fallback does not exist', async () => {
    const { deps } = fakeDeps();
    expect(await resolveCliPath('', deps)).toBeNull();
  });

  it('falls back to the home-directory path when the PATH search throws', async () => {
    const { deps } = fakeDeps({ pathThrows: true, existing: [FALLBACK] });
    expect(await resolveCliPath('', deps)).toBe(FALLBACK);
  });

  it('returns null when the PATH search throws and the fallback does not exist', async () => {
    const { deps } = fakeDeps({ pathThrows: true });
    expect(await resolveCliPath('', deps)).toBeNull();
  });
});

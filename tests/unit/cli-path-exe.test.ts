// Only a .exe Claude CLI is spawned on Windows (#1, final review). Gecko's
// Subprocess runs a .bat or .cmd through `cmd.exe /s/c`, whose quoting does not
// protect the --settings JSON, so a `&` in a PDF file name would run commands.
// The rule lives in the pure core; pathSearch and fileExists are faked.
import { describe, expect, it } from 'vitest';

import { detectCliPath, isSpawnableCliPath, resolveCliPath, type CliPathDeps } from '../../src/core/cli-path';
import { cliPathStatus } from '../../src/core/prefs-pane-text';

const HOME = 'C:/Users/u';
const FALLBACK = 'C:/Users/u/.local/bin/claude.exe';

function fakeDeps(paths: Record<string, string | null>, existing: string[] = [], isWin = true) {
  const pathSearchCalls: string[] = [];
  const deps: CliPathDeps = {
    pathSearch: async (name) => {
      pathSearchCalls.push(name);
      return paths[name] ?? null;
    },
    fileExists: async (path) => existing.includes(path),
    homeDir: HOME,
    isWin,
  };
  return { deps, pathSearchCalls };
}

describe('isSpawnableCliPath (src/core/cli-path)', () => {
  it('accepts a .exe path on Windows, in any letter case', () => {
    expect([
      isSpawnableCliPath('C:\\bin\\claude.exe', true),
      isSpawnableCliPath('C:\\BIN\\CLAUDE.EXE', true),
      isSpawnableCliPath('  C:\\bin\\claude.Exe  ', true),
    ]).toEqual([true, true, true]);
  });

  it('rejects .cmd, .bat, .ps1 and extensionless paths on Windows', () => {
    expect([
      isSpawnableCliPath('C:\\Users\\u\\AppData\\Roaming\\npm\\claude.cmd', true),
      isSpawnableCliPath('C:\\tools\\claude.bat', true),
      isSpawnableCliPath('C:\\tools\\claude.ps1', true),
      isSpawnableCliPath('C:\\Users\\u\\AppData\\Roaming\\npm\\claude', true),
      isSpawnableCliPath('C:\\tools\\claude.exe.cmd', true),
    ]).toEqual([false, false, false, false, false]);
  });

  it('rejects an empty or blank path', () => {
    expect([isSpawnableCliPath('', true), isSpawnableCliPath('   ', false)]).toEqual([false, false]);
  });

  it('accepts an extensionless path outside Windows', () => {
    expect(isSpawnableCliPath('/usr/local/bin/claude', false)).toBe(true);
  });
});

describe('resolveCliPath on Windows (src/core/cli-path)', () => {
  it('returns null for a .cmd override, without falling back to auto-detection', async () => {
    const { deps, pathSearchCalls } = fakeDeps({ claude: 'C:/bin/claude.exe' }, [FALLBACK]);
    expect(await resolveCliPath('C:/Users/u/AppData/Roaming/npm/claude.cmd', deps)).toBeNull();
    expect(pathSearchCalls).toEqual([]);
  });

  it('returns null for a .bat or extensionless override', async () => {
    const { deps } = fakeDeps({ claude: 'C:/bin/claude.exe' });
    expect([await resolveCliPath('C:/tools/claude.bat', deps), await resolveCliPath('C:/tools/claude', deps)]).toEqual([
      null,
      null,
    ]);
  });

  it('returns a .EXE override unchanged apart from trimming', async () => {
    const { deps } = fakeDeps({});
    expect(await resolveCliPath(' D:/Tools/CLAUDE.EXE ', deps)).toBe('D:/Tools/CLAUDE.EXE');
  });
});

describe('detectCliPath on Windows (src/core/cli-path)', () => {
  it('skips an extensionless shim earlier on PATH and searches for claude.exe', async () => {
    const { deps, pathSearchCalls } = fakeDeps({
      claude: 'C:/Users/u/AppData/Roaming/npm/claude',
      'claude.exe': 'C:/Users/u/.local/bin/claude.exe',
    });
    expect(await detectCliPath(deps)).toBe('C:/Users/u/.local/bin/claude.exe');
    expect(pathSearchCalls).toEqual(['claude', 'claude.exe']);
  });

  it('skips a .cmd shim found on PATH', async () => {
    const { deps } = fakeDeps({ claude: 'C:/npm/claude.cmd', 'claude.exe': 'C:/bin/claude.exe' });
    expect(await detectCliPath(deps)).toBe('C:/bin/claude.exe');
  });

  it('keeps the home-directory fallback when PATH has only a shim', async () => {
    const { deps } = fakeDeps({ claude: 'C:/npm/claude.cmd' }, [FALLBACK]);
    expect(await detectCliPath(deps)).toBe(FALLBACK);
  });

  it('returns null rather than a shim when nothing else is found', async () => {
    const { deps } = fakeDeps({ claude: 'C:/npm/claude' });
    expect(await detectCliPath(deps)).toBeNull();
  });

  it('keeps an extensionless PATH result outside Windows', async () => {
    const { deps, pathSearchCalls } = fakeDeps({ claude: '/usr/local/bin/claude' }, [], false);
    expect(await detectCliPath(deps)).toBe('/usr/local/bin/claude');
    expect(pathSearchCalls).toEqual(['claude']);
  });
});

describe('CLI path status text on Windows (src/core/prefs-pane-text)', () => {
  it('says plainly that an override must be claude.exe, and offers the detected path', () => {
    expect(cliPathStatus('C:\\npm\\claude.cmd', 'C:\\bin\\claude.exe', true)).toBe(
      'This path cannot be used: the Claude CLI path must be claude.exe. Clear the field to use the auto-detected path: C:\\bin\\claude.exe',
    );
  });

  it('asks for the claude.exe path when an unusable override is set and nothing is detected', () => {
    expect(cliPathStatus('C:\\npm\\claude', null, true)).toBe(
      'This path cannot be used: the Claude CLI path must be claude.exe. Install Claude Code, or enter the path of its claude.exe.',
    );
  });

  it('keeps the usual text for a .exe override', () => {
    expect(cliPathStatus('D:\\claude.EXE', 'C:\\bin\\claude.exe', true)).toBe(
      'Using the path above. Auto-detected: C:\\bin\\claude.exe',
    );
  });
});

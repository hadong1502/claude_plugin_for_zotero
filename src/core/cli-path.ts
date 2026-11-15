// CLI path resolution (#5): which Claude CLI executable the plugin runs, given
// the user's override preference, a PATH search and a fallback location.
// Pure: the Zotero-backed dependencies live in src/modules/cli-locator.ts.

/** System boundaries for resolving the CLI path: the process environment and the filesystem. */
export interface CliPathDeps {
  pathSearch: (name: string) => Promise<string | null>;
  fileExists: (path: string) => Promise<boolean>;
  homeDir: string;
  /** Windows rules apply: only a `.exe` CLI path is usable (see isSpawnableCliPath). Defaults to false. */
  isWin?: boolean;
}

/**
 * Whether the plugin may spawn this CLI path (#1).
 * On Windows only a `.exe` (any letter case) qualifies. Gecko's Subprocess runs
 * a `.bat` or `.cmd` through `cmd.exe /s/c`, and its argument quoting does not
 * protect the `--settings` JSON: a `&` in a PDF file name would run commands.
 * An extensionless npm shim can't be spawned at all.
 */
export function isSpawnableCliPath(path: string, isWin: boolean): boolean {
  const trimmed = path.trim();
  if (!trimmed) return false;
  return !isWin || /\.exe$/i.test(trimmed);
}

async function searchPath(deps: CliPathDeps, name: string): Promise<string | null> {
  try {
    return await deps.pathSearch(name);
  } catch {
    // A failing PATH search counts as "not found".
    return null;
  }
}

/**
 * Resolve the CLI path without the override: PATH first, then the home-directory fallback.
 * On Windows a PATH hit that isn't a `.exe` (an npm `claude` or `claude.cmd`
 * shim earlier on PATH) is skipped in favour of a search for `claude.exe`.
 */
export async function detectCliPath(deps: CliPathDeps): Promise<string | null> {
  const isWin = deps.isWin ?? false;
  const found = await searchPath(deps, 'claude');
  if (found && isSpawnableCliPath(found, isWin)) return found;
  if (found && isWin) {
    const exe = await searchPath(deps, 'claude.exe');
    if (exe && isSpawnableCliPath(exe, isWin)) return exe;
  }

  const fallback = `${deps.homeDir}/.local/bin/claude.exe`;
  return (await deps.fileExists(fallback)) ? fallback : null;
}

/**
 * Resolve the Claude CLI path (#1, Preferences; user story 47).
 * 1. A non-empty (trimmed) override wins. Its existence is not checked: a wrong
 *    path surfaces later as `cli-not-found`. On Windows an override that isn't a
 *    `.exe` is unusable, so the result is `null` (no fallback to detection).
 * 2. Otherwise the PATH search result for `claude` (on Windows, for `claude.exe`
 *    when the first hit isn't a `.exe`).
 * 3. Otherwise `<homeDir>/.local/bin/claude.exe` if it exists.
 * 4. Otherwise `null`.
 */
export async function resolveCliPath(override: string, deps: CliPathDeps): Promise<string | null> {
  const trimmed = override.trim();
  if (trimmed) return isSpawnableCliPath(trimmed, deps.isWin ?? false) ? trimmed : null;
  return detectCliPath(deps);
}

// CLI path resolution (#5): which Claude CLI executable the plugin runs, given
// the user's override preference, a PATH search and a fallback location.
// Pure: the Zotero-backed dependencies live in src/modules/cli-locator.ts.

/** System boundaries for resolving the CLI path: the process environment and the filesystem. */
export interface CliPathDeps {
  pathSearch: (name: string) => Promise<string | null>;
  fileExists: (path: string) => Promise<boolean>;
  homeDir: string;
}

/** Resolve the CLI path without the override: PATH first, then the home-directory fallback. */
export async function detectCliPath(deps: CliPathDeps): Promise<string | null> {
  let found: string | null = null;
  try {
    found = await deps.pathSearch('claude');
  } catch {
    // A failing PATH search counts as "not found".
    found = null;
  }
  if (found) return found;

  const fallback = `${deps.homeDir}/.local/bin/claude.exe`;
  return (await deps.fileExists(fallback)) ? fallback : null;
}

/**
 * Resolve the Claude CLI path (#1, Preferences; user story 47).
 * 1. A non-empty (trimmed) override wins, unchecked: a wrong path surfaces later as `cli-not-found`.
 * 2. Otherwise the PATH search result for `claude`.
 * 3. Otherwise `<homeDir>/.local/bin/claude.exe` if it exists.
 * 4. Otherwise `null`.
 */
export async function resolveCliPath(override: string, deps: CliPathDeps): Promise<string | null> {
  const trimmed = override.trim();
  if (trimmed) return trimmed;
  return detectCliPath(deps);
}

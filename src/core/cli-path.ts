// CLI path resolution (#5): which Claude CLI executable the plugin runs, given
// the user's override preference, a PATH search and a fallback location.

/** System boundaries for resolving the CLI path: the process environment and the filesystem. */
export interface CliPathDeps {
  pathSearch: (name: string) => Promise<string | null>;
  fileExists: (path: string) => Promise<boolean>;
  homeDir: string;
}

export async function resolveCliPath(override: string, deps: CliPathDeps): Promise<string | null> {
  throw new Error('resolveCliPath: not implemented (#5)');
}

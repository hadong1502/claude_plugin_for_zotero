// Zotero-side CLI locator (#5): the real dependencies of resolveCliPath
// (Subprocess.pathSearch, IOUtils.exists, the home directory) and the one
// function the Runner calls to learn which Claude CLI to run.
import { detectCliPath, resolveCliPath } from '../core/cli-path';
import type { CliPathDeps } from '../core/cli-path';
import { getPref } from './prefs';

interface SubprocessModule {
  Subprocess: { pathSearch(bin: string, environment?: Record<string, string>): Promise<string> };
}

/**
 * Gecko's nsIFile (behind IOUtils and Subprocess) rejects Windows paths with
 * forward slashes, and resolveCliPath joins the fallback with `/`.
 */
function toNativePath(path: string): string {
  return Zotero.isWin ? path.replace(/\//g, '\\') : path;
}

/** Real dependencies for resolveCliPath inside Zotero. */
export function zoteroCliPathDeps(): CliPathDeps {
  return {
    async pathSearch(name) {
      try {
        const { Subprocess } = ChromeUtils.importESModule(
          'resource://gre/modules/Subprocess.sys.mjs',
        ) as SubprocessModule;
        return await Subprocess.pathSearch(name);
      } catch {
        // Subprocess.pathSearch rejects when nothing on PATH matches.
        return null;
      }
    },
    async fileExists(path) {
      try {
        return await IOUtils.exists(toNativePath(path));
      } catch {
        return false;
      }
    },
    homeDir: Services.dirsvc.get('Home', Components.interfaces.nsIFile).path,
  };
}

/** The auto-detected CLI path (PATH, then ~/.local/bin/claude.exe), ignoring the override. */
export async function detectCliPathInZotero(): Promise<string | null> {
  const found = await detectCliPath(zoteroCliPathDeps());
  return found === null ? null : toNativePath(found);
}

/**
 * The Claude CLI to run: the cliPath preference override if set, otherwise the
 * auto-detected path; `null` when none is found (the Runner reports `cli-not-found`).
 */
export async function getCliPath(): Promise<string | null> {
  const resolved = await resolveCliPath(getPref('cliPath'), zoteroCliPathDeps());
  return resolved === null ? null : toNativePath(resolved);
}

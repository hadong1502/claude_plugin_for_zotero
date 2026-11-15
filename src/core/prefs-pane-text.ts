// Display rules of the preferences pane (#5). Pure; the pane wiring lives in
// src/modules/prefs-pane-window.ts.
import { isSpawnableCliPath } from './cli-path';

const UNUSABLE_OVERRIDE = 'This path cannot be used: the Claude CLI path must be claude.exe.';

/** Status line under the CLI path field. `isWin` applies the Windows `.exe`-only rule. */
export function cliPathStatus(override: string, detected: string | null, isWin = false): string {
  const found = detected ?? 'not found';
  if (override.trim()) {
    if (!isSpawnableCliPath(override, isWin)) {
      return detected
        ? `${UNUSABLE_OVERRIDE} Clear the field to use the auto-detected path: ${detected}`
        : `${UNUSABLE_OVERRIDE} Install Claude Code, or enter the path of its claude.exe.`;
    }
    return `Using the path above. Auto-detected: ${found}`;
  }
  if (detected) return `Using the auto-detected path: ${detected}`;
  return 'Claude CLI not found. Install Claude Code or enter its path above.';
}

/** The Answer language pref `match` (match the question) shows as an empty field. */
export function answerLanguageToField(pref: string): string {
  return pref === 'match' ? '' : pref;
}

/** An empty or blank Answer language field stores `match`. */
export function answerLanguageFromField(text: string): string {
  return text.trim() || 'match';
}

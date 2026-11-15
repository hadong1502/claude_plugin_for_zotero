// Error reporting shared by the Zotero-side modules (#1): failures go to
// Zotero's error console instead of breaking the rest of the plugin.

/** Report `e` to Zotero's error console, wrapping a non-Error value in an Error. */
export function logError(e: unknown): void {
  Zotero.logError(e instanceof Error ? e : new Error(String(e)));
}

/** Run `action`; if it throws, report the error and carry on. */
export function guard(action: () => void): void {
  try {
    action();
  } catch (e) {
    logError(e);
  }
}

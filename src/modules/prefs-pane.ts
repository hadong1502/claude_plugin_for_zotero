// Claude preferences pane in Zotero's settings (#5; #1 Preferences).
// Zotero also drops a plugin's panes when the plugin shuts down (an observer in
// xpcom/preferencePanes.js); unregistering here as well keeps shutdown
// self-contained and lets a re-enable register the same pane ID again.
import { getPluginInfo } from '../plugin-info';

/** Stable pane ID, e.g. for Zotero.Utilities.Internal.openPreferences(PANE_ID). */
export const PANE_ID = 'claude-for-zotero';

let registeredID: string | undefined;

export async function registerPrefsPane(): Promise<void> {
  try {
    registeredID = await Zotero.PreferencePanes.register({
      pluginID: getPluginInfo().id,
      id: PANE_ID,
      label: 'Claude',
      // Relative to the plugin root.
      src: 'content/preferences.xhtml',
      scripts: ['content/scripts/claudeforzotero-prefs.js'],
    });
  } catch (e) {
    // A missing pane must not stop the rest of the plugin.
    Zotero.logError(e instanceof Error ? e : new Error(String(e)));
  }
}

export function unregisterPrefsPane(): void {
  const id = registeredID;
  registeredID = undefined;
  if (id !== undefined) Zotero.PreferencePanes.unregister(id);
}

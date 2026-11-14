// Entry of the preferences pane script (content/scripts/claudeforzotero-prefs.js),
// which Zotero loads into the pane's own scope in the settings window before the
// pane markup. The markup's onload calls window.ClaudeForZoteroPrefs.init(root);
// the settings window reloads when the plugin is disabled, so nothing lingers.
import { initPrefsPane } from './modules/prefs-pane-window';

(window as unknown as { ClaudeForZoteroPrefs: { init(root: Element): Promise<void> } }).ClaudeForZoteroPrefs = {
  init: initPrefsPane,
};

// Plugin lifecycle, called from addon/bootstrap.js. Each feature (Claude Pane,
// reader popup, preferences pane) has one register call at startup and one
// unregister call at shutdown; the features themselves live in src/modules.
import { registerClaudePane, unregisterClaudePane } from './modules/claude-pane';
import { registerPrefsPane, unregisterPrefsPane } from './modules/prefs-pane';
import { registerReaderPopup, unregisterReaderPopup } from './modules/reader-popup';
import { setPluginInfo } from './plugin-info';
import type { PluginInfo } from './plugin-info';

export async function onStartup(info: PluginInfo): Promise<void> {
  setPluginInfo(info);
  registerClaudePane();
  registerReaderPopup();
  await registerPrefsPane();
}

/** Per-window UI setup; nothing yet. */
export function onMainWindowLoad(win: Window): void {
  void win;
}

/** Per-window UI teardown; nothing yet. */
export function onMainWindowUnload(win: Window): void {
  void win;
}

export function onShutdown(): void {
  unregisterPrefsPane();
  unregisterReaderPopup();
  unregisterClaudePane();
  setPluginInfo(undefined);
}

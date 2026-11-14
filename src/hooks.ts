// Plugin lifecycle, called from addon/bootstrap.js. Each feature has exactly
// one registration call here, so later tickets fill only their own module.
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

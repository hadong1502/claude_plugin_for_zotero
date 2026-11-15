// Lifecycle hooks (#2): startup and shutdown call one registration function
// each for the Claude Pane, the reader selection popup and the preferences
// pane. The feature modules are replaced by spies; the hooks are the seam.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/claude-pane', () => ({
  registerClaudePane: vi.fn(),
  unregisterClaudePane: vi.fn(),
}));
vi.mock('../../src/modules/reader-popup', () => ({
  registerReaderPopup: vi.fn(),
  unregisterReaderPopup: vi.fn(),
}));
vi.mock('../../src/modules/prefs-pane', () => ({
  registerPrefsPane: vi.fn(async () => {}),
  unregisterPrefsPane: vi.fn(),
}));

import { onShutdown, onStartup } from '../../src/hooks';
import { getPluginInfo } from '../../src/plugin-info';
import * as claudePane from '../../src/modules/claude-pane';
import * as readerPopup from '../../src/modules/reader-popup';
import * as prefsPane from '../../src/modules/prefs-pane';

const info = {
  id: 'claude-for-zotero@local',
  version: '0.1.0',
  rootURI: 'jar:file:///tmp/claude-for-zotero.xpi!/',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lifecycle hooks (src/hooks)', () => {
  it('startup registers the Claude Pane, the reader popup and the preferences pane once each', async () => {
    await onStartup(info);
    expect([
      vi.mocked(claudePane.registerClaudePane).mock.calls.length,
      vi.mocked(readerPopup.registerReaderPopup).mock.calls.length,
      vi.mocked(prefsPane.registerPrefsPane).mock.calls.length,
    ]).toEqual([1, 1, 1]);
  });

  it('startup calls no unregistration function', async () => {
    await onStartup(info);
    expect([
      vi.mocked(claudePane.unregisterClaudePane).mock.calls.length,
      vi.mocked(readerPopup.unregisterReaderPopup).mock.calls.length,
      vi.mocked(prefsPane.unregisterPrefsPane).mock.calls.length,
    ]).toEqual([0, 0, 0]);
  });

  it('shutdown unregisters the Claude Pane, the reader popup and the preferences pane once each', async () => {
    await onStartup(info);
    onShutdown();
    expect([
      vi.mocked(claudePane.unregisterClaudePane).mock.calls.length,
      vi.mocked(readerPopup.unregisterReaderPopup).mock.calls.length,
      vi.mocked(prefsPane.unregisterPrefsPane).mock.calls.length,
    ]).toEqual([1, 1, 1]);
  });

  it('startup records the plugin id, version and root URI', async () => {
    await onStartup(info);
    expect(getPluginInfo()).toEqual(info);
  });
});

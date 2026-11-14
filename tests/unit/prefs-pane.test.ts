// Preferences pane (#5; #1 Preferences, user stories 46-50 and 59). The pane
// UI itself is checked by hand in #11; here: its registration with
// Zotero.PreferencePanes (faked), the display rules for the CLI path and the
// Answer language, and the pane markup's bindings to the preference keys.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PREF_KEYS } from '../../src/core/prefs-schema';
import {
  answerLanguageFromField,
  answerLanguageToField,
  cliPathStatus,
} from '../../src/core/prefs-pane-text';
import { registerPrefsPane, unregisterPrefsPane } from '../../src/modules/prefs-pane';
import { setPluginInfo } from '../../src/plugin-info';

const addonFile = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../addon/${rel}`, import.meta.url)), 'utf8');

describe('CLI path status text (src/core/prefs-pane-text)', () => {
  it('shows the auto-detected path when no override is set', () => {
    expect(cliPathStatus('', 'C:\\bin\\claude.exe')).toBe('Using the auto-detected path: C:\\bin\\claude.exe');
  });

  it('says the CLI was not found when there is no override and nothing is detected', () => {
    expect(cliPathStatus('   ', null)).toBe('Claude CLI not found. Install Claude Code or enter its path above.');
  });

  it('names the override as in use and still shows what auto-detection found', () => {
    expect([cliPathStatus('D:\\claude.exe', 'C:\\bin\\claude.exe'), cliPathStatus('D:\\claude.exe', null)]).toEqual([
      'Using the path above. Auto-detected: C:\\bin\\claude.exe',
      'Using the path above. Auto-detected: not found',
    ]);
  });
});

describe('Answer language field (src/core/prefs-pane-text)', () => {
  it('shows the default "match" as an empty field (the placeholder says "Match the question")', () => {
    expect([answerLanguageToField('match'), answerLanguageToField('French')]).toEqual(['', 'French']);
  });

  it('stores an empty or blank field as "match" and trims a language', () => {
    expect([answerLanguageFromField(''), answerLanguageFromField('  '), answerLanguageFromField(' German ')]).toEqual([
      'match',
      'match',
      'German',
    ]);
  });
});

describe('preferences pane registration (src/modules/prefs-pane)', () => {
  let register: ReturnType<typeof vi.fn>;
  let unregister: ReturnType<typeof vi.fn>;
  let logError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    register = vi.fn(async (options: { id?: string }) => options.id ?? 'generated-id');
    unregister = vi.fn();
    logError = vi.fn();
    vi.stubGlobal('Zotero', { PreferencePanes: { register, unregister }, logError });
    setPluginInfo({ id: 'claude-for-zotero@local', version: '0.1.0', rootURI: 'jar:file:///x.xpi!/' });
  });

  afterEach(() => {
    unregisterPrefsPane();
    setPluginInfo(undefined);
    vi.unstubAllGlobals();
  });

  it('registers one Claude pane for the plugin with its XHTML and script', async () => {
    await registerPrefsPane();
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0]).toMatchObject({
      pluginID: 'claude-for-zotero@local',
      label: 'Claude',
      src: 'content/preferences.xhtml',
      scripts: ['content/scripts/claudeforzotero-prefs.js'],
    });
  });

  it('unregisters the pane it registered, once', async () => {
    await registerPrefsPane();
    const paneID = await register.mock.results[0].value;
    unregisterPrefsPane();
    unregisterPrefsPane();
    expect(unregister.mock.calls).toEqual([[paneID]]);
  });

  it('does nothing on unregister when no pane was registered', () => {
    unregisterPrefsPane();
    expect(unregister).not.toHaveBeenCalled();
  });

  it('logs instead of throwing when Zotero refuses the pane', async () => {
    register.mockRejectedValueOnce(new Error('Pane with ID x already registered'));
    await expect(registerPrefsPane()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(1);
    unregisterPrefsPane();
    expect(unregister).not.toHaveBeenCalled();
  });
});

describe('preferences pane markup (addon/content/preferences.xhtml)', () => {
  const markup = addonFile('content/preferences.xhtml');

  it('binds the CLI path, default model and About me fields to their preference keys', () => {
    for (const name of ['cliPath', 'defaultModel', 'aboutMe'] as const) {
      expect(markup).toContain(`preference="${PREF_KEYS[name]}"`);
    }
  });

  it('offers Haiku, Sonnet and Opus as default models', () => {
    const values = [...markup.matchAll(/<menuitem[^>]*value="([^"]+)"/g)].map((m) => m[1]);
    expect(values).toEqual(['haiku', 'sonnet', 'opus']);
  });

  it('has no XML declaration, since Zotero parses it as a fragment', () => {
    expect(markup.trimStart().startsWith('<?xml')).toBe(false);
  });
});

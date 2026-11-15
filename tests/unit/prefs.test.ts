// Typed preference accessors (#2): read and write the four preferences of #1
// through Zotero.Prefs, falling back to the defaults. Zotero.Prefs is faked
// with an in-memory map of full Gecko keys.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPref, setPref } from '../../src/modules/prefs';

let store: Map<string, string | number | boolean>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('Zotero', {
    Prefs: {
      get: (key: string, global?: boolean) => (global ? store.get(key) : undefined),
      set: (key: string, value: string | number | boolean, global?: boolean) => {
        if (global) store.set(key, value);
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('preference accessors (src/modules/prefs)', () => {
  it('returns the defaults when nothing is stored', () => {
    expect([
      getPref('cliPath'),
      getPref('defaultModel'),
      getPref('aboutMe'),
      getPref('answerLanguage'),
    ]).toEqual(['', 'sonnet', '', 'match']);
  });

  it('reads a stored value from the plugin branch', () => {
    store.set('extensions.claude-for-zotero.aboutMe', 'PhD student in physics');
    expect(getPref('aboutMe')).toBe('PhD student in physics');
  });

  it('writes a value under the plugin branch', () => {
    setPref('defaultModel', 'opus');
    expect(store.get('extensions.claude-for-zotero.defaultModel')).toBe('opus');
  });

  it('reads back what it wrote', () => {
    setPref('cliPath', 'C:/tools/claude.exe');
    expect(getPref('cliPath')).toBe('C:/tools/claude.exe');
  });

  it('falls back to sonnet when the stored model is not a model alias', () => {
    store.set('extensions.claude-for-zotero.defaultModel', 'gpt');
    expect(getPref('defaultModel')).toBe('sonnet');
  });

  it('falls back to the default when the stored value has the wrong type', () => {
    store.set('extensions.claude-for-zotero.answerLanguage', 42);
    expect(getPref('answerLanguage')).toBe('match');
  });
});

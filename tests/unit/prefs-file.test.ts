/// <reference types="node" />
// The scaffold ships addon/prefs.js as the plugin's default preferences. It
// must declare exactly the keys and defaults of src/core/prefs-schema (#2).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('default preferences file (addon/prefs.js)', () => {
  it('declares the four preferences on the plugin branch with their defaults', () => {
    const source = readFileSync(new URL('../../addon/prefs.js', import.meta.url), 'utf-8');
    const declared: Record<string, unknown> = {};
    for (const [, key, value] of source.matchAll(/^pref\(\s*"([^"]+)"\s*,\s*(.+?)\s*\);\s*$/gm)) {
      declared[key] = JSON.parse(value);
    }
    expect(declared).toEqual({
      'extensions.claude-for-zotero.cliPath': '',
      'extensions.claude-for-zotero.defaultModel': 'sonnet',
      'extensions.claude-for-zotero.aboutMe': '',
      'extensions.claude-for-zotero.answerLanguage': 'match',
    });
  });
});

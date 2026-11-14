// Preference names, full keys and defaults (#1 "Preferences"). Pure: the
// Zotero-backed accessors live in src/modules/prefs.ts, and addon/prefs.js
// declares the same defaults (kept in sync by tests/unit/prefs-file.test.ts).
import type { ModelAlias } from './types';

/** Gecko preference branch every preference of this plugin lives under. */
export const PREF_PREFIX = 'extensions.claude-for-zotero';

export interface PrefValues {
  /** Path to the Claude CLI; empty means auto-detect. */
  cliPath: string;
  defaultModel: ModelAlias;
  /** Free text added to every question. */
  aboutMe: string;
  /** Answer language; `match` means the question's language. */
  answerLanguage: string;
}

export const PREF_DEFAULTS: Readonly<PrefValues> = {
  cliPath: '',
  defaultModel: 'sonnet',
  aboutMe: '',
  answerLanguage: 'match',
};

export type PrefName = keyof typeof PREF_DEFAULTS;

/** Full Gecko preference key of each preference. */
export const PREF_KEYS: Readonly<Record<PrefName, string>> = {
  cliPath: `${PREF_PREFIX}.cliPath`,
  defaultModel: `${PREF_PREFIX}.defaultModel`,
  aboutMe: `${PREF_PREFIX}.aboutMe`,
  answerLanguage: `${PREF_PREFIX}.answerLanguage`,
};

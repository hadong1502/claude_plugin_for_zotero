// Typed, Zotero-backed accessors for the preferences in src/core/prefs-schema.
// A missing or malformed stored value reads as its default.
import { PREF_DEFAULTS, PREF_KEYS } from '../core/prefs-schema';
import type { PrefName, PrefValues } from '../core/prefs-schema';
import type { ModelAlias } from '../core/types';

const MODEL_ALIASES: readonly ModelAlias[] = ['haiku', 'sonnet', 'opus'];

function isValid<K extends PrefName>(name: K, value: unknown): value is PrefValues[K] {
  if (typeof value !== 'string') return false;
  if (name === 'defaultModel') return (MODEL_ALIASES as readonly string[]).includes(value);
  return true;
}

export function getPref<K extends PrefName>(name: K): PrefValues[K] {
  const value = Zotero.Prefs.get(PREF_KEYS[name], true);
  return isValid(name, value) ? value : PREF_DEFAULTS[name];
}

export function setPref<K extends PrefName>(name: K, value: PrefValues[K]): void {
  Zotero.Prefs.set(PREF_KEYS[name], value, true);
}

// The plugin's bundle runs in Zotero's plugin sandbox (xpcom/plugins.js
// _loadScope in Zotero 10.0.8), not in a window. Its globals are the
// sandbox's own plus a fixed list; window-only globals such as
// `structuredClone` are missing there, and using one fails every question
// in Zotero while every Node test passes (#1, found in the #11 manual run).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThreadStore } from '../../src/core/thread-store';

/** Globals that exist in a window or in Node but not in Zotero's plugin sandbox. */
const MISSING_IN_SANDBOX = [
  'structuredClone',
  'queueMicrotask',
  'AbortController',
  'AbortSignal',
  'performance',
  'navigator',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

/** Lines of `src` that call `name` as a bare global (not `win.name`, not in a comment). */
function bareUses(name: string): string[] {
  const bare = new RegExp(`(^|[^.\\w$#])${name}\\s*\\(`);
  return sourceFiles(join(__dirname, '../../src')).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line) && bare.test(line))
      .map(({ i }) => `${file}:${i + 1}`),
  );
}

describe("Zotero's plugin sandbox", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the Thread Store works without structuredClone', () => {
    vi.stubGlobal('structuredClone', undefined);
    const store = new ThreadStore();
    store.appendQuestion(1, 'What is this?', 'sonnet', 'pane');
    expect(store.get(1).turns.map((t) => t.question)).toEqual(['What is this?']);
  });

  it('a Thread read from the store is a copy', () => {
    vi.stubGlobal('structuredClone', undefined);
    const store = new ThreadStore();
    store.appendQuestion(1, 'What is this?', 'sonnet', 'pane');
    const copy = store.get(1);
    copy.turns[0]!.question = 'changed';
    copy.turns.push({ ...copy.turns[0]! });
    expect(store.get(1).turns.map((t) => t.question)).toEqual(['What is this?']);
  });

  it.each(MISSING_IN_SANDBOX)('src never calls the window-only global %s', (name) => {
    expect(bareUses(name)).toEqual([]);
  });
});

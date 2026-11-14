/// <reference types="node" />
// #2: the plugin imports Gecko modules with ChromeUtils.importESModule only.
// ChromeUtils.import was removed in Firefox 140 (Zotero 10 shims it with a
// warning). Guard every source file the .xpi is built from.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|js|mjs|xhtml)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe('Gecko module imports', () => {
  it('never calls the removed ChromeUtils.import in src or addon', () => {
    const offenders = [...sourceFiles('src'), ...sourceFiles('addon')].filter((file) =>
      /ChromeUtils\s*\.\s*import\s*\(/.test(readFileSync(file, 'utf-8')),
    );
    expect(offenders).toEqual([]);
  });
});

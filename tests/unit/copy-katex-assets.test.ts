import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyKatexAssets } from '../../scripts/copy-katex-assets.mjs';

// #6: KaTeX assets are copied into the add-on so the Claude Pane can typeset math.
describe('copyKatexAssets', () => {
  let dest: string;

  beforeEach(() => {
    dest = fs.mkdtempSync(path.join(os.tmpdir(), 'katex-assets-'));
  });

  afterEach(() => {
    fs.rmSync(dest, { recursive: true, force: true });
  });

  it('copies the KaTeX stylesheet and licence', async () => {
    await copyKatexAssets(dest);
    expect(
      ['katex.min.css', 'LICENSE'].filter((f) => fs.existsSync(path.join(dest, f))),
    ).toEqual(['katex.min.css', 'LICENSE']);
  });

  it('copies woff2 fonts', async () => {
    await copyKatexAssets(dest);
    const fonts = fs.readdirSync(path.join(dest, 'fonts'));
    expect({
      hasWoff2: fonts.some((f) => f.endsWith('.woff2')),
      others: fonts.filter((f) => !f.endsWith('.woff2')),
    }).toEqual({ hasWoff2: true, others: [] });
  });

  it('every woff2 the stylesheet references was copied', async () => {
    await copyKatexAssets(dest);
    const css = fs.readFileSync(path.join(dest, 'katex.min.css'), 'utf8');
    const referenced = [...css.matchAll(/url\(\s*["']?fonts\/([^"')]+\.woff2)["']?\s*\)/g)].map(
      (m) => m[1],
    );
    const missing = referenced.filter((n) => !fs.existsSync(path.join(dest, 'fonts', n)));
    expect({ count: referenced.length > 0, missing }).toEqual({ count: true, missing: [] });
  });
});

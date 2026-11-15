// Copies KaTeX stylesheet, fonts and licence into the add-on (#6). The Claude
// Pane loads the stylesheet from a content-accessible chrome package, so the
// fonts it references must sit next to it. Only .woff2 is shipped: Gecko
// picks the first supported format in each @font-face, which is woff2.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

/** Copies the KaTeX assets into destDir; returns the copied file names, relative to it. */
export async function copyKatexAssets(destDir) {
  const katexRoot = path.dirname(require.resolve('katex/package.json'));
  const fontsSrc = path.join(katexRoot, 'dist', 'fonts');
  const fontsDest = path.join(destDir, 'fonts');
  // Start fonts/ afresh so fonts from an older KaTeX do not linger.
  await fs.rm(fontsDest, { recursive: true, force: true });
  await fs.mkdir(fontsDest, { recursive: true });

  const copied = [];
  const copy = async (from, to) => {
    await fs.copyFile(from, path.join(destDir, to));
    copied.push(to);
  };

  await copy(path.join(katexRoot, 'dist', 'katex.min.css'), 'katex.min.css');
  await copy(path.join(katexRoot, 'LICENSE'), 'LICENSE');
  const fonts = (await fs.readdir(fontsSrc)).filter((name) => name.endsWith('.woff2')).sort();
  for (const name of fonts) await copy(path.join(fontsSrc, name), `fonts/${name}`);
  return copied;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dest = path.join(repoRoot, 'addon', 'content', 'katex');
  const copied = await copyKatexAssets(dest);
  console.log(`copy-katex-assets: ${copied.length} files into ${path.relative(repoRoot, dest)}`);
}

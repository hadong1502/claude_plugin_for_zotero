import { defineConfig } from 'zotero-plugin-scaffold';

// Names shared by the manifest, bootstrap.js and the bundle. `addonRef` is the
// chrome package name and the bundle's file name; `addonInstance` is the
// property the bundle sets on the Zotero global.
const addonName = 'Claude for Zotero';
const addonID = 'claude-for-zotero@local';
const addonRef = 'claudeforzotero';
const addonInstance = 'ClaudeForZotero';

export default defineConfig({
  source: ['src', 'addon'],
  dist: '.scaffold/build',
  name: addonName,
  id: addonID,
  namespace: 'claude-for-zotero',
  xpiName: 'claude-for-zotero',
  // Inert on purpose: this release manifest does not exist (see spec #1).
  updateURL:
    'https://raw.githubusercontent.com/hadong1502/claude_plugin_for_zotero/main/update.json',
  build: {
    assets: ['addon/**/*.*'],
    define: { addonName, addonID, addonRef, addonInstance },
    fluent: { dts: false },
    prefs: {
      // Must equal PREF_PREFIX in src/core/prefs-schema.ts; addon/prefs.js
      // already uses full keys, so nothing is re-prefixed.
      prefix: 'extensions.claude-for-zotero',
      dts: false,
    },
    esbuildOptions: [
      {
        entryPoints: ['src/index.ts'],
        bundle: true,
        format: 'iife',
        target: 'firefox140',
        outfile: `.scaffold/build/addon/content/scripts/${addonRef}.js`,
      },
    ],
  },
  server: {
    // `npm start` must never touch the real Zotero profile or data directory:
    // set ZOTERO_PLUGIN_PROFILE_PATH and ZOTERO_PLUGIN_DATA_DIR in .env (see
    // README) to throwaway folders.
    devtools: false,
  },
});

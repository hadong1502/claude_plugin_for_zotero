// The plugin's handle on the Zotero global, set by src/index.ts and used by
// addon/bootstrap.js ("__addonInstance__" in zotero-plugin.config.ts).
declare namespace Zotero {
  let ClaudeForZotero: { hooks: typeof import('./hooks') } | undefined;
}

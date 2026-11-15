// Identity of the running plugin, as handed to the bootstrap `startup` hook.
// Later tickets need it, e.g. the preferences pane registers with the plugin id.

export interface PluginInfo {
  id: string;
  version: string;
  /** Root of the installed plugin, e.g. `jar:file:///...xpi!/`. */
  rootURI: string;
}

let current: PluginInfo | undefined;

export function setPluginInfo(info: PluginInfo | undefined): void {
  current = info;
}

/** Throws before startup or after shutdown. */
export function getPluginInfo(): PluginInfo {
  if (!current) throw new Error('Claude for Zotero is not started');
  return current;
}

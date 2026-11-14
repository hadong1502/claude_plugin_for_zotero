// The one fixed working directory of every Claude CLI run (#1 Implementation
// Decisions, Backend): `<Zotero data dir>/claude-for-zotero/cli-workdir`. A
// fixed directory keeps CLI sessions resumable. It must stay empty, because
// the CLI lets Read open files inside its cwd without a rule, so the plugin
// never writes into it.

/** Creates the working directory if missing and returns its native path. */
export async function ensureCliWorkdir(): Promise<string> {
  const dir = PathUtils.join(Zotero.DataDirectory.dir, 'claude-for-zotero', 'cli-workdir');
  await IOUtils.makeDirectory(dir, { createAncestors: true, ignoreExisting: true });
  return dir;
}

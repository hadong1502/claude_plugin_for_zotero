// Argument passing for the Subprocess adapter (#4). Pure.
//
// Subprocess.sys.mjs on Windows joins the arguments into one command line and
// quotes only those containing whitespace or `"` (quoteString in
// subprocess_win.worker.js). An empty argument is therefore joined as nothing
// and the child never sees it: `--setting-sources ""` would arrive as
// `--setting-sources --system-prompt`, which the CLI rejects. The CLI's option
// parser reads `--name=` as the option with an empty value, so each
// option/empty-value pair is folded into that form, which needs no quoting.

/** `['--tools', '']` becomes `['--tools=']`; every other argument is unchanged. */
export function foldEmptyOptionValues(args: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (args[i + 1] === '' && /^--[^=]+$/.test(arg)) {
      out.push(`${arg}=`);
      i++;
    } else {
      out.push(arg);
    }
  }
  return out;
}

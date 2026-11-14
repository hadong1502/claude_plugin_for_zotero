// happy-dom reports (it does not throw) when a parsed <iframe src> cannot load
// its page, through the Node console it captured when the environment started.
// The safe-html tests parse hostile iframes on purpose, so drop only that one
// message and leave every other console error intact.
import nodeConsole from 'node:console';

const original = nodeConsole.error.bind(nodeConsole);
nodeConsole.error = (...args: unknown[]): void => {
  if (String(args[0]).includes('Iframe page loading is disabled')) return;
  original(...args);
};

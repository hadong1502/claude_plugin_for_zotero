/* global Zotero, Services, Components, APP_SHUTDOWN */
// Bootstrap for Claude for Zotero. Zotero loads this file into a sandbox and
// calls the hooks below. It loads the bundled plugin (src/index.ts) and
// forwards each hook to src/hooks.ts. Gecko modules are imported with
// ChromeUtils.importESModule only (never the removed ChromeUtils.import).

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, rootURI }, reason) {
  await Zotero.initializationPromise;

  const aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "__addonRef__", rootURI + "content/"],
  ]);

  // The bundle sets Zotero.__addonInstance__ = { hooks }.
  const ctx = { rootURI };
  ctx._globalThis = ctx;
  Services.scriptloader.loadSubScript(
    `${rootURI}content/scripts/__addonRef__.js`,
    ctx,
  );
  await Zotero.__addonInstance__.hooks.onStartup({ id, version, rootURI });
}

function onMainWindowLoad({ window }) {
  Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
}

function onMainWindowUnload({ window }) {
  Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
}

function shutdown({ id, version, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }
  Zotero.__addonInstance__?.hooks.onShutdown();
  delete Zotero.__addonInstance__;
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}

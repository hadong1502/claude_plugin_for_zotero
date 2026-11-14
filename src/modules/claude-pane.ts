// Claude Pane registration and wiring (#4): an item pane section, shown in the
// library item pane and in each reader tab's context pane. One Thread Store
// and one Ask Controller live as long as the plugin; every section instance
// gets its own view (claude-pane-view.ts) over them.
import { AskController } from '../core/ask-controller';
import type { ItemLike } from '../core/item-context';
import { ClaudeRunner } from '../core/runner';
import { ThreadStore } from '../core/thread-store';
import type { Thread, ThreadKey, Turn } from '../core/types';
import { getPluginInfo } from '../plugin-info';
import { ClaudePaneView, type PaneTarget } from './claude-pane-view';
import { getCliPath } from './cli-locator';
import { ensureCliWorkdir } from './cli-workdir';
import { saveAnswerNote, saveThreadNote } from './library-writer';
import { getPref } from './prefs';
import { createSubprocessPort } from './subprocess-port';

const PANE_ID = 'claude';
/** Built from addon/locale/en-US/pane.ftl; the build prefixes file and message names. */
const FTL_FILE = 'claude-for-zotero-pane.ftl';
const HEADER_L10N_ID = 'claude-for-zotero-pane-header';
const SIDENAV_L10N_ID = 'claude-for-zotero-pane-sidenav';
/**
 * The icons use `context-fill` to follow the theme, which Gecko honours only
 * for privileged image URLs such as chrome://. `claudeforzotero` is the chrome
 * package bootstrap.js registers (addonRef in zotero-plugin.config.ts).
 */
const ICONS = 'chrome://claudeforzotero/content/icons';
/**
 * Answer styles (#6), loaded into each main window as author sheets. KaTeX's
 * CSS comes from the content-accessible package bootstrap.js registers, so
 * the reader (#7) can use the same URL and fonts.
 */
const STYLESHEETS = [
  'chrome://claudeforzotero-katex/content/katex.min.css',
  'chrome://claudeforzotero/content/pane.css',
];
/** Windows the stylesheets are loaded into, so each is loaded once. */
let styledWindows = new WeakSet<Window>();

interface Registration {
  /** Key returned by registerSection; false if it failed. */
  sectionKey: string | false;
  controller: AskController;
  quitObserver: { observe(): void };
}

let registration: Registration | undefined;

export function registerClaudePane(): void {
  if (registration) return;
  try {
    const { id } = getPluginInfo();
    const store = new ThreadStore();
    const controller = new AskController({
      store,
      async createRunner() {
        const cliPath = await getCliPath();
        if (cliPath === null) return null;
        const workdir = await ensureCliWorkdir();
        return new ClaudeRunner(createSubprocessPort(), { cliPath, workdir });
      },
      settings: () => ({ aboutMe: getPref('aboutMe'), answerLanguage: getPref('answerLanguage') }),
    });
    const views = new WeakMap<Element, ClaudePaneView>();
    const viewDeps = {
      store,
      controller,
      defaultModel: () => getPref('defaultModel'),
      logError,
      openLink: (url: string) => Zotero.launchURL(url),
      saveAnswerNote: async (key: ThreadKey, turn: Turn) =>
        saveAnswerNote(await threadItem(key), turn),
      saveThreadNote: async (key: ThreadKey, thread: Thread) =>
        saveThreadNote(await threadItem(key), thread),
    };

    const sectionKey = Zotero.ItemPaneManager.registerSection({
      paneID: PANE_ID,
      pluginID: id,
      header: { l10nID: HEADER_L10N_ID, icon: `${ICONS}/claude-16.svg` },
      sidenav: { l10nID: SIDENAV_L10N_ID, icon: `${ICONS}/claude-20.svg` },
      onInit: ({ body, doc }) => {
        guard(() => {
          insertFluent(doc.defaultView);
          loadStylesheets(doc.defaultView);
          views.set(body, new ClaudePaneView(body, viewDeps));
        });
      },
      onItemChange: ({ body, item, setEnabled }) => {
        guard(() => {
          const target = paneTarget(item);
          setEnabled(target !== null);
          views.get(body)?.show(target);
        });
      },
      onRender: ({ body, item }) => {
        guard(() => views.get(body)?.show(paneTarget(item)));
      },
      onDestroy: ({ body }) => {
        guard(() => {
          views.get(body)?.destroy();
          views.delete(body);
        });
      },
    });
    if (sectionKey === false) logError(new Error('Claude Pane: registerSection failed'));

    // Quitting Zotero skips the plugin's shutdown hook, so stop any running
    // CLI here (#1 user story 58).
    const quitObserver = { observe: () => guard(() => controller.cancelAll()) };
    Services.obs.addObserver(quitObserver, 'quit-application');

    for (const win of Zotero.getMainWindows()) {
      insertFluent(win);
      loadStylesheets(win);
    }
    registration = { sectionKey, controller, quitObserver };
  } catch (e) {
    logError(e);
  }
}

export function unregisterClaudePane(): void {
  const current = registration;
  registration = undefined;
  if (!current) return;
  guard(() => current.controller.cancelAll());
  guard(() => Services.obs.removeObserver(current.quitObserver, 'quit-application'));
  guard(() => {
    if (current.sectionKey !== false) Zotero.ItemPaneManager.unregisterSection(current.sectionKey);
  });
  guard(() => {
    for (const win of Zotero.getMainWindows()) removeFluent(win);
  });
  guard(() => {
    for (const win of Zotero.getMainWindows()) removeStylesheets(win);
  });
  styledWindows = new WeakSet<Window>();
}

/**
 * The Thread an item belongs to: a regular item's own, or for an attachment
 * its parent's (a standalone attachment has its own). Notes and other items
 * have none, and the section is disabled for them.
 */
function paneTarget(item: Zotero.Item | null | undefined): PaneTarget | null {
  if (!item || !(item.isRegularItem() || item.isAttachment())) return null;
  const key = item.isAttachment() && item.parentItemID ? item.parentItemID : item.id;
  const metadataItem = (key === item.id ? item : Zotero.Items.get(key)) || item;
  return { key, item: itemLike(metadataItem) };
}

/** The item a Thread belongs to (its key is the item's ID), where Saved Notes go. */
async function threadItem(key: ThreadKey): Promise<Zotero.Item> {
  const item = await Zotero.Items.getAsync(key);
  if (!item) throw new Error(`Claude Pane: item ${key} not found`);
  return item;
}

/** Reads base-mapped fields too, e.g. a case's name as its title. */
function itemLike(item: Zotero.Item): ItemLike {
  return {
    getField: (name) => String(item.getField(name, false, true) ?? ''),
    getCreators: () => item.getCreators(),
  };
}

/**
 * Zotero registers the plugin's .ftl files but does not link them into its
 * windows; the section header and sidenav button need them linked.
 */
function insertFluent(win: Window | null | undefined): void {
  (win as { MozXULElement?: { insertFTLIfNeeded(path: string): void } } | null | undefined)
    ?.MozXULElement?.insertFTLIfNeeded(FTL_FILE);
}

function removeFluent(win: Window): void {
  for (const link of win.document.querySelectorAll(`link[rel="localization"][href="${FTL_FILE}"]`)) {
    link.remove();
  }
}

/** Loads the Answer stylesheets into a main window once; never throws. */
function loadStylesheets(win: Window | null | undefined): void {
  if (!win || styledWindows.has(win)) return;
  styledWindows.add(win);
  for (const url of STYLESHEETS) {
    guard(() => win.windowUtils.loadSheetUsingURIString(url, authorSheet(win)));
  }
}

function removeStylesheets(win: Window): void {
  if (!styledWindows.has(win)) return;
  styledWindows.delete(win);
  for (const url of STYLESHEETS) {
    guard(() => win.windowUtils.removeSheetUsingURIString(url, authorSheet(win)));
  }
}

/** nsIDOMWindowUtils.AUTHOR_SHEET; the Gecko typings mark the constant optional. */
function authorSheet(win: Window): number {
  return win.windowUtils.AUTHOR_SHEET ?? 2;
}

function guard(action: () => void): void {
  try {
    action();
  } catch (e) {
    logError(e);
  }
}

function logError(e: unknown): void {
  Zotero.logError(e instanceof Error ? e : new Error(String(e)));
}

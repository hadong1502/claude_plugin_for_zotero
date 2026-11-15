// Claude Pane registration and wiring (#4): an item pane section, shown in the
// library item pane and in each reader tab's context pane. One Thread Store
// and one Ask Controller live as long as the plugin; every section instance
// gets its own view (claude-pane-view.ts) over them. Continue in Pane (#10)
// imports an Inline Card's exchange into this store and reveals the section
// in the reader tab's context pane. The item's PDF (#8) is looked up here for
// the pane and the Inline Card alike.
import { AskController, type PaperSource } from '../core/ask-controller';
import type { ContinuedExchange } from '../core/continue-in-pane';
import type { ItemLike } from '../core/item-context';
import { findItemPdf, type ItemPdfLookup } from '../core/item-pdf';
import { ClaudeRunner } from '../core/runner';
import { ThreadStore } from '../core/thread-store';
import type { Thread, ThreadKey, Turn } from '../core/types';
import { getPluginInfo } from '../plugin-info';
import { ClaudePaneView, type PaneTarget } from './claude-pane-view';
import { getCliPath } from './cli-locator';
import { ensureCliWorkdir, paperTextDir } from './cli-workdir';
import { guard, logError } from './errors';
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
  /**
   * Key returned by registerSection; false if it failed. Zotero namespaces the
   * paneID with the plugin ID, and this key is the section's `data-pane`.
   */
  sectionKey: string | false;
  store: ThreadStore;
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
      onItemChange: ({ body, item, tabType, setEnabled }) => {
        guard(() => {
          const target = paneTarget(item, readerTabID(body, tabType));
          setEnabled(target !== null);
          views.get(body)?.show(target);
        });
      },
      onRender: ({ body, item, tabType }) => {
        guard(() => views.get(body)?.show(paneTarget(item, readerTabID(body, tabType))));
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
    registration = { sectionKey, store, controller, quitObserver };
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
 * Continue in Pane (#10): adds the exchange to the Thread of `item` (keyed as
 * the pane keys it) and reveals the Claude Pane in the reader tab `tabID`.
 * Returns whether the exchange was imported. Revealing runs after the import
 * and its failures are only logged, so they never lose the import. A reader
 * in its own window has no tab, and nothing is revealed.
 */
export function continueInPane(
  item: Zotero.Item,
  exchange: ContinuedExchange,
  tabID?: string,
): boolean {
  const current = registration;
  if (!current || current.sectionKey === false) {
    logError(new Error('Continue in Pane: the Claude Pane is not registered'));
    return false;
  }
  const target = paneTarget(item);
  if (!target) {
    logError(new Error(`Continue in Pane: item ${item.id} has no Thread`));
    return false;
  }
  current.store.importExchange(target.key, exchange);
  revealPane(current.sectionKey, tabID).catch(logError);
  return true;
}

/** The reader tab's item pane, as far as revealing a section uses it. */
interface ItemDetailsLike extends Element {
  scrollToPane(paneID: string, behavior?: 'smooth' | 'instant'): Promise<unknown>;
}

interface SidenavLike {
  container?: ItemDetailsLike | null;
  /** True while the sidenav shows the notes pane; false selects the item pane. */
  _contextNotesPaneVisible?: boolean;
}

interface MainWindowLike extends Window {
  ZoteroContextPane?: { collapsed: boolean; sidenav?: SidenavLike | null };
  Zotero_Tabs?: { selectedID?: string };
}

/**
 * Opens the context pane, switches it from notes to the item pane, opens the
 * section and scrolls to it, as a click on the section's sidenav button does
 * (Zotero 10.0.8, chrome/content/zotero/elements/itemPaneSidenav.js
 * handleButtonClick; contextPane.js; elements/itemPaneContainerBase.mjs
 * scrollToPane).
 */
async function revealPane(paneID: string, tabID: string | undefined): Promise<void> {
  if (!tabID) throw new Error('Continue in Pane: the reader is not in a tab; nothing to reveal');
  const win = Zotero.getMainWindow() as MainWindowLike | null;
  const contextPane = win?.ZoteroContextPane;
  if (!win || !contextPane) throw new Error('Continue in Pane: no context pane to reveal');
  const sidenav = contextPane.sidenav;
  // contextPane.js gives each reader tab's item pane the id `${tabID}-context`;
  // the sidenav's container is the selected tab's.
  const details =
    (win.document.getElementById(`${tabID}-context`) as ItemDetailsLike | null) ??
    (win.Zotero_Tabs?.selectedID === tabID ? sidenav?.container : null);
  if (typeof details?.scrollToPane !== 'function') {
    throw new Error(`Continue in Pane: reader tab ${tabID} has no item pane`);
  }

  const section = details.querySelector(`collapsible-section[data-pane="${win.CSS.escape(paneID)}"]`) as
    | (Element & { open?: boolean })
    | null;
  if (section && !section.open) section.open = true;

  const collapsed = contextPane.collapsed;
  // The getter reads false while the context pane is collapsed even if the
  // notes pane is selected, so the item pane is selected unconditionally.
  const notesShown = sidenav?._contextNotesPaneVisible === true;
  if (sidenav && '_contextNotesPaneVisible' in sidenav) sidenav._contextNotesPaneVisible = false;
  const behavior: 'smooth' | 'instant' = collapsed || notesShown ? 'instant' : 'smooth';
  // While the context pane is collapsed, scrollToPane only records the pane,
  // and expanding re-renders the item pane, which scrolls to it. Scrolling
  // again after expanding covers an expand that does not re-render; it does
  // nothing once the section is at the top.
  await details.scrollToPane(paneID, behavior);
  if (collapsed) {
    contextPane.collapsed = false;
    await details.scrollToPane(paneID, 'instant');
  }
}

/**
 * The Thread an item belongs to: a regular item's own, or for an attachment
 * its parent's (a standalone attachment has its own). Notes and other items
 * have none, and the section is disabled for them. In a reader tab
 * (`readerTab` set) the item's PDF is the reader's attachment.
 */
function paneTarget(item: Zotero.Item | null | undefined, readerTab?: string): PaneTarget | null {
  if (!item || !(item.isRegularItem() || item.isAttachment())) return null;
  const key = item.isAttachment() && item.parentItemID ? item.parentItemID : item.id;
  const metadataItem = (key === item.id ? item : Zotero.Items.get(key)) || item;
  return {
    key,
    item: itemLike(metadataItem),
    paper: () =>
      itemPaper(
        readerTab === undefined ? { selected: item } : { reader: Zotero.Reader.getByTabID(readerTab)?._item },
      ),
  };
}

/**
 * The reader tab a section instance is in, or undefined in the library. In a
 * reader tab the hooks get the parent item, and the tab's item pane is the
 * section's `item-details`, whose `tabID` is the tab's (Zotero 10.0.8,
 * elements/contextPane.js _addItemContext; elements/itemDetails.js render).
 * An unknown tab ('') finds no reader, so the pane then has no PDF.
 */
function readerTabID(body: Element, tabType: string): string | undefined {
  if (tabType !== 'reader') return undefined;
  return (body.closest('item-details') as (Element & { tabID?: string }) | null)?.tabID ?? '';
}

/** Where the item's PDF is: a reader tab's attachment, or the item selected in the library. */
export type PaperLocation = { reader: Zotero.Item | null | undefined } | { selected: Zotero.Item };

/**
 * The item's PDF (#8) as a Paper Source, with its text file (#11), or undefined when there is none.
 * Its `pdfPath` is undefined when the file is missing. Never rejects.
 */
export async function itemPaper(where: PaperLocation): Promise<PaperSource | undefined> {
  try {
    const attachment = await findItemPdf(pdfLookup(where), isPdf);
    if (!attachment) return undefined;
    const path = await attachment.getFilePathAsync();
    return {
      pdfPath: path === false ? undefined : path,
      // Extracted text; may be slow (PDFWorker), and Stop does not wait for it.
      loadText: async () => {
        try {
          return await attachment.attachmentText;
        } catch (e) {
          logError(e);
          return undefined;
        }
      },
      textFile: () => writePaperText(attachment),
    };
  } catch (e) {
    logError(e);
    return undefined;
  }
}

/**
 * The paper's text file (#11): writes the attachment's extracted text, in
 * full, to `<paper-text dir>/<attachment key>.txt` and returns its path, or
 * undefined when the text is blank. Rewritten on each use. Never rejects.
 */
async function writePaperText(attachment: Zotero.Item): Promise<string | undefined> {
  try {
    const text = await attachment.attachmentText;
    if (!text?.trim()) return undefined;
    const dir = paperTextDir();
    await IOUtils.makeDirectory(dir, { createAncestors: true, ignoreExisting: true });
    const path = PathUtils.join(dir, `${attachment.key}.txt`);
    await IOUtils.writeUTF8(path, text, { tmpPath: `${path}.tmp` });
    return path;
  } catch (e) {
    logError(e);
    return undefined;
  }
}

function pdfLookup(where: PaperLocation): ItemPdfLookup<Zotero.Item> {
  if ('reader' in where) return { reader: where.reader };
  const item = where.selected;
  const regular = item.isRegularItem()
    ? item
    : item.parentItemID
      ? Zotero.Items.get(item.parentItemID)
      : undefined;
  return {
    selected: item.isAttachment() ? item : undefined,
    best: regular && regular.isRegularItem() ? () => regular.getBestAttachment() : undefined,
  };
}

function isPdf(attachment: Zotero.Item): boolean {
  return attachment.isAttachment() && attachment.attachmentContentType === 'application/pdf';
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

/** Marks the plugin's <link> elements in a main window, so shutdown finds them. */
const STYLESHEET_MARK = 'data-claudeforzotero-stylesheet';

/**
 * Loads the Answer stylesheets into a main window once, as <link> elements;
 * never throws. Not windowUtils.loadSheetUsingURIString: in Zotero 10.0.8 it
 * fails with NS_ERROR_FAILURE for the plugin's chrome:// sheets, which left
 * Answers unstyled and KaTeX's 400em square-root graphic unclipped (#1, #11
 * manual run).
 */
function loadStylesheets(win: Window | null | undefined): void {
  if (!win || styledWindows.has(win)) return;
  styledWindows.add(win);
  const doc = win.document;
  for (const url of STYLESHEETS) {
    guard(() => {
      const link = doc.createElement('link');
      link.setAttribute(STYLESHEET_MARK, '');
      link.rel = 'stylesheet';
      link.href = url;
      (doc.head ?? doc.documentElement).append(link);
    });
  }
}

function removeStylesheets(win: Window): void {
  if (!styledWindows.has(win)) return;
  styledWindows.delete(win);
  for (const link of win.document.querySelectorAll(`link[${STYLESHEET_MARK}]`)) link.remove();
}

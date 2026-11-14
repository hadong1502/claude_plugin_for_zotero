// Ask Claude Button and Inline Card wiring (#7). The button goes into the
// PDF reader's text-selection popup; pressing it opens one Inline Card
// (inline-card.ts) anchored to the Selection. Inline Questions run through
// their own Thread Store and Ask Controller, never the Claude Pane's Thread.
// Only one card exists at a time, across all reader tabs. The card's save
// buttons (#9) write a note of the item, or a highlight on the Selection from
// the popup's annotation as captured at the press. Its Continue in Pane
// button (#10) hands the exchange to the Claude Pane (claude-pane.ts).
//
// Reader internals used here (Zotero 10.0.8, resource://zotero/reader/reader.js):
// the selection popup renders inside `.primary-view` or `.secondary-view` of
// the reader document; `reader._internalReader._activePrimaryView` (or
// `_activeSecondaryView`) is the PDF view, whose `getClientRectForPopup(position)`
// gives the Selection's rectangle in its iframe (`_iframe`, `_iframeWindow`),
// and whose `#viewerContainer` scrolls and `#viewer` resizes on zoom.
import { AskController } from '../core/ask-controller';
import type { Box } from '../core/card-placement';
import { itemContextFrom, type ItemLike } from '../core/item-context';
import { ClaudeRunner } from '../core/runner';
import type { SelectionAnnotation } from '../core/saving';
import { ThreadStore } from '../core/thread-store';
import type { ItemContext } from '../core/types';
import { getPluginInfo } from '../plugin-info';
import { continueInPane, itemPaper } from './claude-pane';
import { getCliPath } from './cli-locator';
import { ensureCliWorkdir } from './cli-workdir';
import { InlineCard, removeStyles, type CapturedSelection, type CardAnchor } from './inline-card';
import { saveAnnotation, saveAnswerNote } from './library-writer';
import { getPref } from './prefs';
import { snapshotSelection } from './selection-snapshot';
import { createSubprocessPort } from './subprocess-port';

const BUTTON_CLASS = 'cfz-ask-claude';

type PopupHandler = _ZoteroTypes.Reader.EventHandler<'renderTextSelectionPopup'>;
type PopupEvent = _ZoteroTypes.Reader.EventParams<'renderTextSelectionPopup'>;

/** The reader's PDF view, as far as this module uses it. */
interface PdfViewLike {
  _iframe?: HTMLIFrameElement | null;
  _iframeWindow?: (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
  getClientRectForPopup?(position: unknown): ArrayLike<number>;
}

interface InternalReaderLike {
  _activePrimaryView?: PdfViewLike | null;
  _activeSecondaryView?: PdfViewLike | null;
}

/** The selection popup's annotation (`params.annotation`), as far as this module uses it. */
interface PopupAnnotation {
  type?: unknown;
  color?: unknown;
  sortIndex?: unknown;
  text?: unknown;
  pageLabel?: unknown;
  position?: { pageIndex?: unknown; rects?: unknown };
}

interface Registration {
  handler: PopupHandler;
  store: ThreadStore;
  controller: AskController;
  quitObserver: { observe(): void };
  card: InlineCard | null;
  nextKey: number;
}

let registration: Registration | undefined;

export function registerReaderPopup(): void {
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
    const handler: PopupHandler = (event) => guard(() => onSelectionPopup(event));
    // Quitting Zotero skips the plugin's shutdown hook, so stop any running
    // CLI here (#1 user story 58).
    const quitObserver = { observe: () => guard(() => controller.cancelAll()) };
    const current: Registration = { handler, store, controller, quitObserver, card: null, nextKey: 1 };
    registration = current;
    Services.obs.addObserver(quitObserver, 'quit-application');
    Zotero.Reader.registerEventListener('renderTextSelectionPopup', handler, id);
  } catch (e) {
    logError(e);
  }
}

export function unregisterReaderPopup(): void {
  const current = registration;
  registration = undefined;
  if (!current) return;
  guard(() => Zotero.Reader.unregisterEventListener('renderTextSelectionPopup', current.handler));
  guard(() => current.card?.close());
  current.card = null;
  guard(() => current.controller.cancelAll());
  guard(() => Services.obs.removeObserver(current.quitObserver, 'quit-application'));
  // Buttons in popups that are still open, and the card styles.
  for (const doc of readerDocuments()) {
    guard(() => {
      for (const button of doc.querySelectorAll(`.${BUTTON_CLASS}`)) button.remove();
      removeStyles(doc);
    });
  }
}

/** Appends the Ask Claude Button; must run synchronously in the event. */
function onSelectionPopup(event: PopupEvent): void {
  const { reader, doc, params, append } = event;
  if (reader.type !== 'pdf') return;
  const button = doc.createElement('button');
  button.className = `toolbar-button wide-button ${BUTTON_CLASS}`;
  button.textContent = 'Ask Claude';
  const annotation = params.annotation as unknown as PopupAnnotation;
  button.addEventListener('click', () =>
    guard(() => openCard(reader as unknown as ReaderLike, doc, annotation, button)),
  );
  append(button);
}

interface ReaderLike {
  _item: Zotero.Item;
  /** The reader's tab (xpcom/reader.js). */
  tabID?: string;
  _internalReader?: InternalReaderLike;
}

function openCard(
  reader: ReaderLike,
  doc: Document,
  annotation: PopupAnnotation,
  button: HTMLElement,
): void {
  const current = registration;
  if (!current) return;
  // Captured now, so the card outlives the popup.
  const selection = captureSelection(annotation);
  const selectionAnnotation = captureAnnotation(annotation);
  const anchor = createAnchor(reader, doc, annotation, button);
  const attachment = reader._item;
  // Started once, here; every question of the card awaits it (#8).
  const selectionSnapshot =
    selection.pageIndex === undefined
      ? Promise.resolve(undefined)
      : snapshotSelection(reader, selection.pageIndex, selection.rects);
  // The item's PDF is the reader's attachment; looked up once, here (#8).
  const paper = itemPaper({ reader: attachment });

  // One card at a time: the old card closes and its run is cancelled.
  current.card?.close();
  const key = current.nextKey++;
  current.card = new InlineCard(doc, key, selection, anchor, {
    store: current.store,
    controller: current.controller,
    defaultModel: () => getPref('defaultModel'),
    itemContext: () => itemContextOf(attachment),
    selectionSnapshot,
    paper,
    logError,
    openLink: (url) => Zotero.launchURL(url),
    onClose: (card) => {
      if (current.card === card) current.card = null;
    },
    saveNote: async (turn) => saveAnswerNote(await noteItemOf(attachment), turn),
    saveAnnotation: async (turn) => {
      if (!selectionAnnotation) throw new Error('Inline Card: the Selection was not captured');
      return saveAnnotation(attachment, selectionAnnotation, turn.question, turn.answer);
    },
    continueInPane: (exchange) => continueInPane(attachment, exchange, reader.tabID),
  });
}

/**
 * The popup's annotation as plain data, copied at the press so a Saved
 * Annotation outlives the popup; null if it has no position.
 */
function captureAnnotation(annotation: PopupAnnotation): SelectionAnnotation | null {
  let position: unknown;
  try {
    position = JSON.parse(JSON.stringify(annotation.position ?? null));
  } catch (e) {
    logError(e);
    return null;
  }
  if (!position || typeof position !== 'object') return null;
  const text = (value: unknown): string | undefined =>
    value === undefined || value === null ? undefined : String(value);
  return {
    type: text(annotation.type),
    color: text(annotation.color),
    sortIndex: text(annotation.sortIndex),
    pageLabel: text(annotation.pageLabel),
    position,
    text: text(annotation.text),
  };
}

/** Where a Saved Note of a reader's attachment goes: its parent item, or the attachment itself. */
async function noteItemOf(attachment: Zotero.Item): Promise<Zotero.Item> {
  if (!attachment.parentItemID) return attachment;
  const parent = await Zotero.Items.getAsync(attachment.parentItemID);
  if (!parent) throw new Error(`Inline Card: item ${attachment.parentItemID} not found`);
  return parent;
}

function captureSelection(annotation: PopupAnnotation): CapturedSelection {
  const text = typeof annotation.text === 'string' ? annotation.text : String(annotation.text ?? '');
  const pageLabel =
    annotation.pageLabel === undefined || annotation.pageLabel === null || annotation.pageLabel === ''
      ? undefined
      : String(annotation.pageLabel);
  const position = annotation.position;
  const pageIndex = typeof position?.pageIndex === 'number' ? position.pageIndex : undefined;
  const rects: number[][] = [];
  const rawRects = position?.rects as ArrayLike<ArrayLike<unknown>> | undefined;
  for (let i = 0; rawRects && i < rawRects.length; i++) {
    rects.push(Array.from(rawRects[i], Number));
  }
  return { text, pageLabel, pageIndex, rects };
}

/**
 * Tracks the Selection through the PDF view that showed the popup. If the
 * view cannot be measured, the card stays where the popup was.
 */
function createAnchor(
  reader: ReaderLike,
  doc: Document,
  annotation: PopupAnnotation,
  button: HTMLElement,
): CardAnchor {
  const primary = !button.closest('.secondary-view');
  const internal = reader._internalReader;
  const view = primary ? internal?._activePrimaryView : internal?._activeSecondaryView;
  const position = annotation.position;

  const popupBox = toBox(button.closest('.selection-popup')?.getBoundingClientRect());
  const fallbackView =
    toBox(button.closest('.primary-view, .secondary-view')?.getBoundingClientRect()) ??
    toBox(doc.documentElement.getBoundingClientRect());

  const measureView = (): { anchor: Box; view: Box } | null => {
    if (!view?.getClientRectForPopup || !view._iframe || !position) return null;
    const frame = view._iframe.getBoundingClientRect();
    if (frame.width === 0 && frame.height === 0) return null;
    const r = view.getClientRectForPopup(position);
    const [x1, y1, x2, y2] = [Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3])];
    if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
    return {
      anchor: { left: frame.left + x1, top: frame.top + y1, right: frame.left + x2, bottom: frame.top + y2 },
      view: { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom },
    };
  };

  return {
    measure() {
      try {
        const measured = measureView();
        if (measured) return measured;
      } catch (e) {
        logError(e);
      }
      return popupBox && fallbackView ? { anchor: popupBox, view: fallbackView } : null;
    },
    watch(onMove, onEscape) {
      const disposers: Array<() => void> = [];
      const listen = (target: EventTarget | null | undefined, type: string, fn: (e: Event) => void, capture = false) => {
        if (!target) return;
        target.addEventListener(type, fn, capture);
        disposers.push(() => target.removeEventListener(type, fn, capture));
      };
      const move = () => onMove();
      const escape = (e: Event) => {
        if ((e as KeyboardEvent).key === 'Escape') onEscape();
      };
      guard(() => listen(doc.defaultView, 'resize', move));
      guard(() => {
        const win = view?._iframeWindow;
        if (!win) return;
        // Scroll events do not bubble; capture catches #viewerContainer's.
        listen(win.document, 'scroll', move, true);
        listen(win, 'resize', move);
        listen(win, 'keydown', escape);
        // Zoom resizes the pages without necessarily scrolling.
        const pages = win.document.getElementById('viewer');
        const Observer = win.ResizeObserver;
        if (pages && Observer) {
          const observer = new Observer(() => onMove());
          observer.observe(pages);
          disposers.push(() => observer.disconnect());
        }
      });
      return () => {
        for (const dispose of disposers.splice(0)) guard(dispose);
      };
    },
  };
}

function toBox(rect: DOMRect | null | undefined): Box | null {
  if (!rect) return null;
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

/** The Item Context of a reader's attachment: its parent's metadata, or its own. */
function itemContextOf(attachment: Zotero.Item): ItemContext {
  const parent = attachment.parentItemID ? Zotero.Items.get(attachment.parentItemID) : null;
  const item = parent || attachment;
  const like: ItemLike = {
    getField: (name) => String(item.getField(name, false, true) ?? ''),
    getCreators: () => item.getCreators(),
  };
  return itemContextFrom(like);
}

/** The documents of every open reader tab. */
function readerDocuments(): Document[] {
  const readers = (Zotero.Reader as unknown as { _readers?: Array<{ _iframeWindow?: Window | null }> })
    ._readers;
  const docs: Document[] = [];
  for (const reader of readers ?? []) {
    try {
      const doc = reader._iframeWindow?.document;
      if (doc) docs.push(doc);
    } catch (e) {
      logError(e);
    }
  }
  return docs;
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

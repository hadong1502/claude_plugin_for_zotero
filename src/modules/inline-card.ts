// The Inline Card (#7): one fixed-position card in a PDF reader's document,
// anchored to the Selection it was opened for. It asks about the Selection
// with a Quick Action or a typed Inline Question, streams the rendered Answer
// in, and shows only its latest question: each question starts a fresh
// session. Closing it (✕, Esc, a new card, the reader closing, shutdown)
// cancels its run. Answers are inserted only as sanitised fragments. A done
// Answer can be saved as a note or as an annotation on the Selection (#9),
// only by pressing a button, or continued in the Claude Pane (#10), which
// carries the question, its Answer and its session into the item's Thread and
// closes the card.
import type { AskController } from '../core/ask-controller';
import { renderAnswerHtml } from '../core/answer-renderer';
import { placeCard, type Box, type CardSize } from '../core/card-placement';
import { QUICK_ACTION_WORDINGS } from '../core/context-builder';
import { continuedQuestion, type ContinuedExchange } from '../core/continue-in-pane';
import { errorCopy } from '../core/failure';
import { htmlToFragment } from '../core/safe-html';
import { isSafeLinkHref } from '../core/safe-link';
import type { ThreadStore } from '../core/thread-store';
import type {
  ItemContext,
  ModelAlias,
  QuickAction,
  SelectionContext,
  ThreadKey,
  Turn,
  TurnStatus,
} from '../core/types';
import { INLINE_CARD_CSS } from './inline-card-css';
import { SaveButton } from './save-button';

const MODELS: ReadonlyArray<readonly [ModelAlias, string]> = [
  ['haiku', 'Haiku'],
  ['sonnet', 'Sonnet'],
  ['opus', 'Opus'],
];

/** Button labels; each label is also the question shown in the card (#7). */
const QUICK_ACTIONS: ReadonlyArray<readonly [QuickAction, string]> = [
  ['explain', 'Explain'],
  ['define', 'Define'],
  ['explain-math', 'Explain the math'],
];

const SIZE: CardSize = { width: 320, gap: 8, minHeight: 140, maxHeight: 460 };
const STYLE_ID = 'cfz-inline-card-style';
const KATEX_LINK_ID = 'cfz-inline-card-katex';
/** The content-accessible package bootstrap.js registers (#6). */
const KATEX_CSS = 'chrome://claudeforzotero-katex/content/katex.min.css';

/** The Selection as captured when the Ask Claude Button was pressed. */
export interface CapturedSelection extends SelectionContext {
  pageIndex?: number;
  /** PDF-space rectangles of the Selection on its page. */
  rects: number[][];
}

/** Where the Selection is now, in the card document's client coordinates. */
export interface CardAnchor {
  /** The Selection and the visible view area; null when unknown (keep the last position). */
  measure(): { anchor: Box; view: Box } | null;
  /**
   * Calls `onMove` whenever the Selection may have moved (scroll, zoom,
   * resize) and `onEscape` on Escape in the view. Returns a disposer.
   */
  watch(onMove: () => void, onEscape: () => void): () => void;
}

export interface InlineCardDeps {
  store: Pick<ThreadStore, 'get' | 'subscribe'>;
  controller: Pick<AskController, 'ask' | 'stop' | 'clear' | 'isRunning'>;
  defaultModel(): ModelAlias;
  /** The item's metadata, read when a question is asked. */
  itemContext(): ItemContext;
  logError(e: unknown): void;
  /** Opens an allowed link (see isSafeLinkHref) in the system browser. */
  openLink(url: string): void;
  /** Called once, after the card has closed. */
  onClose(card: InlineCard): void;
  /** Saves the question and its Answer as a note of the item. */
  saveNote(turn: Turn): Promise<unknown>;
  /** Saves the question and its Answer as a highlight on the Selection. */
  saveAnnotation(turn: Turn): Promise<unknown>;
  /**
   * Imports the exchange into the item's Thread and reveals the Claude Pane;
   * returns whether it was imported (the card then closes).
   */
  continueInPane(exchange: ContinuedExchange): boolean;
}

export class InlineCard {
  readonly key: ThreadKey;
  readonly selection: CapturedSelection;
  readonly #deps: InlineCardDeps;
  readonly #doc: Document;
  readonly #root: HTMLElement;
  readonly #body: HTMLElement;
  readonly #question: HTMLElement;
  readonly #answer: HTMLElement;
  readonly #status: HTMLElement;
  readonly #saves: HTMLElement;
  readonly #saveNote: SaveButton;
  readonly #saveAnnotation: SaveButton;
  readonly #continue: HTMLButtonElement;
  readonly #input: HTMLInputElement;
  readonly #sendButton: HTMLButtonElement;
  readonly #modelButtons: Array<[ModelAlias, HTMLButtonElement]> = [];
  readonly #disposers: Array<() => void> = [];
  #model: ModelAlias;
  #closed = false;
  /** The turn last shown; a new turn resets the rendered Answer. */
  #turnId: string | null = null;
  #renderedAnswer: string | null = null;
  #renderedStatus: TurnStatus | null = null;
  #pendingAnswer = '';
  #answerFrame: number | null = null;
  #placeFrame: number | null = null;

  constructor(
    doc: Document,
    key: ThreadKey,
    selection: CapturedSelection,
    anchor: CardAnchor,
    deps: InlineCardDeps,
  ) {
    this.#doc = doc;
    this.key = key;
    this.selection = selection;
    this.#deps = deps;
    this.#model = deps.defaultModel();
    ensureStyles(doc);

    this.#root = this.#el('div', 'cfz-card');
    this.#root.setAttribute('role', 'dialog');
    this.#root.setAttribute('aria-label', 'Ask Claude');

    const header = this.#el('div', 'cfz-card-header');
    const title = this.#el('span', 'cfz-card-title');
    title.textContent = 'Ask Claude';
    header.append(title);
    if (selection.pageLabel) {
      const page = this.#el('span', 'cfz-card-page');
      page.textContent = `page ${selection.pageLabel}`;
      header.append(page);
    }
    const close = this.#button('cfz-card-close', '✕');
    close.title = 'Close';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.close());
    header.append(this.#el('span', 'cfz-card-spacer'), close);

    const actions = this.#el('div', 'cfz-card-actions');
    for (const [action, label] of QUICK_ACTIONS) {
      const button = this.#button('cfz-card-action', label);
      button.title = QUICK_ACTION_WORDINGS[action];
      button.addEventListener('click', () => this.#ask(label, action));
      actions.append(button);
    }

    this.#body = this.#el('div', 'cfz-card-body');
    this.#body.hidden = true;
    this.#question = this.#el('div', 'cfz-card-question');
    this.#answer = this.#el('div', 'cfz-card-answer');
    this.#status = this.#el('div', 'cfz-card-status');
    this.#saveNote = new SaveButton(
      this.#el('button', 'cfz-card-save-note'),
      'Save as note',
      () => this.#saveShown((turn) => this.#deps.saveNote(turn)),
      deps.logError,
    );
    this.#saveAnnotation = new SaveButton(
      this.#el('button', 'cfz-card-save-annotation'),
      'Save as annotation',
      () => this.#saveShown((turn) => this.#deps.saveAnnotation(turn)),
      deps.logError,
    );
    this.#continue = this.#button('cfz-card-continue', 'Continue in Pane');
    this.#continue.title = 'Keep discussing this in the Claude Pane';
    this.#continue.addEventListener('click', () => this.#continueInPane());
    this.#saves = this.#el('div', 'cfz-card-saves');
    this.#saves.hidden = true;
    this.#saves.append(this.#saveNote.element, this.#saveAnnotation.element, this.#continue);
    this.#body.append(this.#question, this.#answer, this.#status, this.#saves);
    // Links in Answers never navigate the reader; allowed ones open in the
    // system browser.
    this.#body.addEventListener('click', (event) => this.#onLinkClick(event));
    // A middle click would otherwise open the link from the reader document.
    this.#body.addEventListener('auxclick', (event) => {
      if (linkOf(event)) event.preventDefault();
    });

    const inputRow = this.#el('div', 'cfz-card-input-row');
    this.#input = this.#el('input', 'cfz-card-input');
    // The reader leaves its shortcuts alone only in input[type="text"]
    // (matched by attribute) and contenteditable elements.
    this.#input.setAttribute('type', 'text');
    this.#input.placeholder = 'Ask about the selection…';
    this.#input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        this.#sendTyped();
      }
    });
    this.#sendButton = this.#button('cfz-card-send', 'Send');
    this.#sendButton.addEventListener('click', () => {
      if (this.#isRunning()) this.#deps.controller.stop(this.key);
      else this.#sendTyped();
    });
    inputRow.append(this.#input, this.#sendButton);

    const models = this.#el('div', 'cfz-card-models');
    const modelsLabel = this.#el('span', 'cfz-card-models-label');
    modelsLabel.textContent = 'Model';
    models.append(modelsLabel);
    for (const [alias, label] of MODELS) {
      const button = this.#button('cfz-card-model', label);
      button.addEventListener('click', () => {
        this.#model = alias;
        this.#renderModels();
      });
      this.#modelButtons.push([alias, button]);
      models.append(button);
    }
    this.#renderModels();

    this.#root.append(header, actions, this.#body, inputRow, models);
    this.#root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    // The reader cancels pointerdown outside its own inputs, which would block
    // selecting Answer text; keep the card's pointer events to itself.
    this.#root.addEventListener('pointerdown', (event) => event.stopPropagation());
    (doc.body ?? doc.documentElement).append(this.#root);

    this.#disposers.push(
      deps.store.subscribe((changed) => {
        if (changed === this.key) this.#render();
      }),
    );
    this.#disposers.push(anchor.watch(() => this.#schedulePlace(anchor), () => this.close()));
    const win = doc.defaultView;
    if (win) {
      // The reader tab closing (or the reader reloading) ends the card.
      const onUnload = () => this.close();
      win.addEventListener('unload', onUnload);
      this.#disposers.push(() => win.removeEventListener('unload', onUnload));
    }

    this.#place(anchor);
    this.#render();
    this.#input.focus();
  }

  get closed(): boolean {
    return this.#closed;
  }

  /** Removes the card and cancels its run; safe to call more than once. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#saveNote.dispose();
    this.#saveAnnotation.dispose();
    for (const dispose of this.#disposers.splice(0)) {
      try {
        dispose();
      } catch (e) {
        this.#deps.logError(e);
      }
    }
    const win = this.#doc.defaultView;
    try {
      if (this.#answerFrame !== null) win?.cancelAnimationFrame(this.#answerFrame);
      if (this.#placeFrame !== null) win?.cancelAnimationFrame(this.#placeFrame);
      this.#root.remove();
    } catch (e) {
      // The reader document may already be gone.
      this.#deps.logError(e);
    }
    this.#answerFrame = this.#placeFrame = null;
    try {
      this.#deps.controller.clear(this.key);
    } finally {
      this.#deps.onClose(this);
    }
  }

  #sendTyped(): void {
    const question = this.#input.value;
    if (question.trim() === '') return;
    this.#input.value = '';
    this.#ask(question);
  }

  /** Asks in a fresh session: any earlier question and its run are dropped. */
  #ask(question: string, quickAction?: QuickAction): void {
    if (this.#closed || question.trim() === '') return;
    let item: ItemContext;
    try {
      item = this.#deps.itemContext();
    } catch (e) {
      this.#deps.logError(e);
      return;
    }
    const { controller } = this.#deps;
    controller.clear(this.key);
    const { text, pageLabel } = this.selection;
    controller
      .ask(this.key, item, question, this.#model, {
        source: 'inline',
        quickAction,
        selection: { text, pageLabel },
      })
      .catch((e: unknown) => this.#deps.logError(e));
  }

  /** Saves the shown turn as it is at the press, if its Answer is done. */
  #saveShown(save: (turn: Turn) => Promise<unknown>): Promise<unknown> {
    const turn = this.#deps.store.get(this.key).turns.at(-1);
    if (!turn || turn.id !== this.#turnId || turn.status !== 'done') {
      return Promise.reject(new Error('Inline Card: the Answer can no longer be saved'));
    }
    return save(turn);
  }

  /** Continues the shown done turn in the Claude Pane, then closes the card. */
  #continueInPane(): void {
    if (this.#closed) return;
    const thread = this.#deps.store.get(this.key);
    const turn = thread.turns.at(-1);
    if (!turn || turn.id !== this.#turnId || turn.status !== 'done') return;
    let imported = false;
    try {
      imported = this.#deps.continueInPane({
        question: continuedQuestion(turn.question, this.selection.text),
        answer: turn.answer,
        model: turn.model,
        sessionId: thread.sessionId,
      });
    } catch (e) {
      this.#deps.logError(e);
    }
    // A failed import keeps the card, so its Answer is not lost.
    if (imported) this.close();
  }

  #isRunning(): boolean {
    const turn = this.#deps.store.get(this.key).turns.at(-1);
    return turn?.status === 'streaming' && this.#deps.controller.isRunning(this.key);
  }

  #render(): void {
    if (this.#closed) return;
    const turn = this.#deps.store.get(this.key).turns.at(-1);
    this.#sendButton.textContent = this.#isRunning() ? 'Stop' : 'Send';
    this.#body.hidden = !turn;
    if (!turn) {
      if (this.#turnId !== null) this.#resetTurn(null);
      return;
    }
    if (turn.id !== this.#turnId) this.#resetTurn(turn.id);
    setText(this.#question, turn.question);
    this.#updateAnswer(turn);
    this.#saves.hidden = turn.status !== 'done';
  }

  #resetTurn(turnId: string | null): void {
    this.#cancelAnswerFrame();
    this.#turnId = turnId;
    this.#renderedAnswer = null;
    this.#renderedStatus = null;
    this.#pendingAnswer = '';
    this.#answer.replaceChildren();
    this.#answer.style.whiteSpace = '';
    setText(this.#question, '');
    setText(this.#status, '');
    this.#status.hidden = true;
    this.#saves.hidden = true;
    this.#saveNote.reset();
    this.#saveAnnotation.reset();
  }

  /** Touches only what changed since the last render. */
  #updateAnswer(turn: Turn): void {
    const statusChanged = turn.status !== this.#renderedStatus;
    const answerChanged = turn.answer !== this.#renderedAnswer;
    if (!statusChanged && !answerChanged) return;

    if (turn.status === 'streaming') {
      if (answerChanged) this.#scheduleAnswer(turn.answer);
    } else {
      // A final status renders at once; a pending frame would be stale.
      this.#cancelAnswerFrame();
      this.#renderAnswer(turn.answer, turn.status);
    }

    if (statusChanged) {
      this.#renderedStatus = turn.status;
      let status = '';
      if (turn.status === 'stopped') status = errorCopy('cancelled', '');
      else if (turn.status === 'error' && turn.error) status = errorCopy(turn.error.kind, turn.error.message);
      setText(this.#status, status);
      this.#status.hidden = status === '';
      this.#status.classList.toggle('cfz-card-error', turn.status === 'error');
    }
  }

  /** Renders a streaming Answer at most once per animation frame, with its latest text. */
  #scheduleAnswer(answer: string): void {
    this.#pendingAnswer = answer;
    if (this.#answerFrame !== null) return;
    const win = this.#doc.defaultView;
    // The empty-Answer placeholder is plain text, so it needs no frame.
    if (answer === '' || !win) {
      this.#renderAnswer(answer, 'streaming');
      return;
    }
    this.#answerFrame = win.requestAnimationFrame(() => {
      this.#answerFrame = null;
      if (!this.#closed) this.#renderAnswer(this.#pendingAnswer, 'streaming');
    });
  }

  #cancelAnswerFrame(): void {
    if (this.#answerFrame === null) return;
    this.#doc.defaultView?.cancelAnimationFrame(this.#answerFrame);
    this.#answerFrame = null;
  }

  #renderAnswer(answer: string, status: TurnStatus): void {
    const element = this.#answer;
    element.hidden = answer === '' && status !== 'streaming';
    if (answer === this.#renderedAnswer) return;
    this.#renderedAnswer = answer;
    element.style.whiteSpace = '';
    if (answer === '') {
      element.textContent = status === 'streaming' ? '…' : '';
      return;
    }
    try {
      element.replaceChildren(htmlToFragment(this.#doc, renderAnswerHtml(answer)));
    } catch (e) {
      // Plain text keeps the Answer readable; pre-wrap keeps its line breaks.
      element.textContent = answer;
      element.style.whiteSpace = 'pre-wrap';
      this.#deps.logError(e);
    }
  }

  /** Links never navigate the reader; only allowed hrefs open, in the system browser. */
  #onLinkClick(event: MouseEvent): void {
    const link = linkOf(event);
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute('href') ?? '';
    if (!isSafeLinkHref(href)) return;
    try {
      this.#deps.openLink(href);
    } catch (e) {
      this.#deps.logError(e);
    }
  }

  #renderModels(): void {
    for (const [alias, button] of this.#modelButtons) {
      button.setAttribute('aria-pressed', String(alias === this.#model));
    }
  }

  /** Repositions on the next frame, once per frame however many events arrive. */
  #schedulePlace(anchor: CardAnchor): void {
    if (this.#closed || this.#placeFrame !== null) return;
    const win = this.#doc.defaultView;
    if (!win) return;
    this.#placeFrame = win.requestAnimationFrame(() => {
      this.#placeFrame = null;
      if (!this.#closed) this.#place(anchor);
    });
  }

  #place(anchor: CardAnchor): void {
    let measured: ReturnType<CardAnchor['measure']>;
    try {
      measured = anchor.measure();
    } catch (e) {
      this.#deps.logError(e);
      return;
    }
    if (!measured) return;
    const placement = placeCard(measured.anchor, measured.view, SIZE);
    const style = this.#root.style;
    style.visibility = placement.visible ? '' : 'hidden';
    style.left = `${placement.left}px`;
    style.maxHeight = `${placement.maxHeight}px`;
    if (placement.side === 'below') {
      style.top = `${placement.y}px`;
      style.bottom = '';
    } else {
      // Anchoring the bottom edge lets the card grow upwards, away from the Selection.
      style.top = '';
      style.bottom = `${this.#doc.documentElement.clientHeight - placement.y}px`;
    }
  }

  #button(className: string, label: string): HTMLButtonElement {
    const button = this.#el('button', className);
    button.type = 'button';
    button.textContent = label;
    return button;
  }

  #el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const element = this.#doc.createElement(tag);
    element.className = className;
    return element;
  }
}

/** Adds the card's stylesheet and KaTeX's CSS to a reader document once. */
function ensureStyles(doc: Document): void {
  const head = doc.head ?? doc.documentElement;
  if (!doc.getElementById(KATEX_LINK_ID)) {
    const link = doc.createElement('link');
    link.id = KATEX_LINK_ID;
    link.rel = 'stylesheet';
    link.href = KATEX_CSS;
    head.append(link);
  }
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = INLINE_CARD_CSS;
    head.append(style);
  }
}

/** Removes what ensureStyles added; for shutdown. */
export function removeStyles(doc: Document): void {
  doc.getElementById(KATEX_LINK_ID)?.remove();
  doc.getElementById(STYLE_ID)?.remove();
}

/** The link an event happened in, if any. */
function linkOf(event: Event): Element | null {
  const node = event.target as Node | null;
  const start = node?.nodeType === 1 ? (node as Element) : node?.parentElement;
  return start?.closest('a') ?? null;
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

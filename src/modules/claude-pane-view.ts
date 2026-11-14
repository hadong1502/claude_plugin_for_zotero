// The Claude Pane's DOM (#4): one view per item pane section instance (the
// library item pane and each reader tab's context pane). It builds its own
// elements in the section body and renders the shown Thread from the Thread
// Store, so every view of one Thread stays in sync. Answers render as
// Markdown with math (#6), inserted only as sanitised fragments.
import type { AskController } from '../core/ask-controller';
import { renderAnswerHtml } from '../core/answer-renderer';
import { errorCopy } from '../core/failure';
import { itemContextFrom, type ItemLike } from '../core/item-context';
import { htmlToFragment } from '../core/safe-html';
import { isSafeLinkHref } from '../core/safe-link';
import type { ThreadStore } from '../core/thread-store';
import type { ModelAlias, ThreadKey, Turn, TurnStatus } from '../core/types';

const HTML_NS = 'http://www.w3.org/1999/xhtml';

const MODELS: ReadonlyArray<readonly [ModelAlias, string]> = [
  ['haiku', 'Haiku'],
  ['sonnet', 'Sonnet'],
  ['opus', 'Opus'],
];

/** What a view shows: the Thread key and the item whose metadata goes with each question. */
export interface PaneTarget {
  key: ThreadKey;
  item: ItemLike;
}

export interface ClaudePaneViewDeps {
  store: Pick<ThreadStore, 'get' | 'subscribe'>;
  controller: Pick<AskController, 'ask' | 'stop' | 'clear' | 'isRunning'>;
  defaultModel(): ModelAlias;
  logError(e: unknown): void;
  /** Opens an allowed link (see isSafeLinkHref) outside Zotero, in the system browser. */
  openLink(url: string): void;
}

interface TurnElements {
  root: HTMLElement;
  question: HTMLElement;
  answer: HTMLElement;
  status: HTMLElement;
  /** The Answer text and status last rendered; null before the first render. */
  renderedAnswer: string | null;
  renderedStatus: TurnStatus | null;
  /** The Answer text waiting for the pending animation frame. */
  pendingAnswer: string;
  /** requestAnimationFrame handle of a pending streaming render, or null. */
  frame: number | null;
}

/** The XUL menulist properties the view uses. */
interface MenuList extends Element {
  selectedItem: Element | null;
}

export class ClaudePaneView {
  readonly #deps: ClaudePaneViewDeps;
  readonly #doc: Document;
  readonly #root: HTMLElement;
  readonly #thread: HTMLElement;
  readonly #input: HTMLTextAreaElement;
  readonly #modelPicker: MenuList;
  readonly #clearButton: HTMLButtonElement;
  readonly #sendButton: HTMLButtonElement;
  readonly #turns = new Map<string, TurnElements>();
  readonly #unsubscribe: () => void;
  #target: PaneTarget | null = null;
  #model: ModelAlias;

  constructor(body: HTMLElement, deps: ClaudePaneViewDeps) {
    this.#deps = deps;
    const doc = body.ownerDocument;
    this.#doc = doc;
    this.#model = deps.defaultModel();

    this.#root = this.#html('div', 'claude-pane');
    this.#root.style.cssText = 'display: flex; flex-direction: column; gap: 8px; min-width: 0;';

    this.#thread = this.#html('div', 'claude-pane-thread');
    this.#thread.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
    // Links in Answers never navigate the Zotero window; allowed ones open
    // in the system browser.
    this.#thread.addEventListener('click', (event) => this.#onLinkClick(event));

    this.#input = this.#html('textarea', 'claude-pane-input');
    this.#input.rows = 3;
    this.#input.placeholder = 'Ask Claude about this item. Enter sends, Shift+Enter adds a line.';
    this.#input.style.cssText = 'width: 100%; box-sizing: border-box; resize: vertical; font: inherit;';
    this.#input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.#send();
      }
    });

    this.#modelPicker = this.#buildModelPicker();

    this.#clearButton = this.#html('button', 'claude-pane-clear');
    this.#clearButton.textContent = 'Clear';
    this.#clearButton.addEventListener('click', () => {
      if (this.#target) this.#deps.controller.clear(this.#target.key);
    });

    this.#sendButton = this.#html('button', 'claude-pane-send');
    this.#sendButton.addEventListener('click', () => {
      if (!this.#target) return;
      if (this.#isRunning()) this.#deps.controller.stop(this.#target.key);
      else this.#send();
    });

    const spacer = this.#html('div');
    spacer.style.flex = '1';
    const controls = this.#html('div', 'claude-pane-controls');
    controls.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    controls.append(this.#modelPicker, spacer, this.#clearButton, this.#sendButton);

    this.#root.append(this.#thread, this.#input, controls);
    body.append(this.#root);

    this.#unsubscribe = deps.store.subscribe((key) => {
      if (this.#target && key === this.#target.key) this.#render();
    });
    this.#render();
  }

  /** Shows the Thread of `target`, or nothing (`null`: the item has no Thread). */
  show(target: PaneTarget | null): void {
    const keyChanged = target?.key !== this.#target?.key;
    this.#target = target;
    if (keyChanged) {
      for (const turn of this.#turns.values()) {
        this.#cancelFrame(turn);
        turn.root.remove();
      }
      this.#turns.clear();
    }
    this.#render();
  }

  destroy(): void {
    this.#unsubscribe();
    for (const turn of this.#turns.values()) this.#cancelFrame(turn);
    this.#turns.clear();
    this.#target = null;
    this.#root.remove();
  }

  #send(): void {
    const target = this.#target;
    if (!target || this.#isRunning()) return;
    const question = this.#input.value;
    if (question.trim() === '') return;
    this.#input.value = '';
    this.#deps.controller
      .ask(target.key, itemContextFrom(target.item), question, this.#model)
      .catch((e: unknown) => this.#deps.logError(e));
  }

  /** A run is in progress and its turn has not ended yet. */
  #isRunning(): boolean {
    if (!this.#target) return false;
    const { turns } = this.#deps.store.get(this.#target.key);
    return (
      turns.at(-1)?.status === 'streaming' && this.#deps.controller.isRunning(this.#target.key)
    );
  }

  #render(): void {
    const turns = this.#target ? this.#deps.store.get(this.#target.key).turns : [];
    const ids = new Set(turns.map((turn) => turn.id));
    for (const [id, elements] of this.#turns) {
      if (!ids.has(id)) {
        this.#cancelFrame(elements);
        elements.root.remove();
        this.#turns.delete(id);
      }
    }
    // Existing turns stay where they are, so a selection in an earlier
    // Answer survives; only new turns are appended, in order.
    for (const turn of turns) {
      let elements = this.#turns.get(turn.id);
      if (!elements) {
        elements = this.#buildTurn();
        this.#turns.set(turn.id, elements);
        this.#thread.append(elements.root);
      }
      this.#updateTurn(elements, turn);
    }

    const running = this.#isRunning();
    const enabled = this.#target !== null;
    this.#sendButton.textContent = running ? 'Stop' : 'Send';
    this.#sendButton.disabled = !enabled;
    this.#clearButton.disabled = !enabled || turns.length === 0;
    this.#input.disabled = !enabled;
  }

  #buildTurn(): TurnElements {
    const root = this.#html('div', 'claude-pane-turn');
    root.style.cssText = 'display: flex; flex-direction: column; gap: 4px; user-select: text;';
    const question = this.#html('div', 'claude-pane-question');
    question.style.cssText = 'font-weight: 600; white-space: pre-wrap; overflow-wrap: anywhere;';
    // Styled by pane.css, scoped under .claude-pane-answer.
    const answer = this.#html('div', 'claude-pane-answer');
    answer.style.cssText = 'overflow-wrap: anywhere;';
    const status = this.#html('div', 'claude-pane-status');
    status.style.cssText = 'white-space: pre-wrap; overflow-wrap: anywhere;';
    root.append(question, answer, status);
    return {
      root,
      question,
      answer,
      status,
      renderedAnswer: null,
      renderedStatus: null,
      pendingAnswer: '',
      frame: null,
    };
  }

  /** Touches only what changed since the turn's last render. */
  #updateTurn(elements: TurnElements, turn: Turn): void {
    setText(elements.question, turn.question);

    const statusChanged = turn.status !== elements.renderedStatus;
    const answerChanged = turn.answer !== elements.renderedAnswer;
    if (!statusChanged && !answerChanged) return;

    if (turn.status === 'streaming') {
      if (answerChanged) this.#scheduleAnswer(elements, turn.answer);
    } else {
      // A final status renders at once; a pending frame would be stale.
      this.#cancelFrame(elements);
      this.#renderAnswer(elements, turn.answer, turn.status);
    }

    if (statusChanged) {
      elements.renderedStatus = turn.status;
      let status = '';
      if (turn.status === 'stopped') status = errorCopy('cancelled', '');
      else if (turn.status === 'error' && turn.error) status = errorCopy(turn.error.kind, turn.error.message);
      setText(elements.status, status);
      elements.status.hidden = status === '';
      elements.status.style.color =
        turn.status === 'error' ? 'var(--accent-red, #d00)' : 'var(--fill-secondary)';
    }
  }

  /** Renders a streaming Answer at most once per animation frame, with its latest text. */
  #scheduleAnswer(elements: TurnElements, answer: string): void {
    elements.pendingAnswer = answer;
    if (elements.frame !== null) return;
    const win = this.#doc.defaultView;
    // The empty-Answer placeholder is plain text, so it needs no frame.
    if (answer === '' || !win) {
      this.#renderAnswer(elements, answer, 'streaming');
      return;
    }
    elements.frame = win.requestAnimationFrame(() => {
      elements.frame = null;
      this.#renderAnswer(elements, elements.pendingAnswer, 'streaming');
    });
  }

  #cancelFrame(elements: TurnElements): void {
    if (elements.frame === null) return;
    this.#doc.defaultView?.cancelAnimationFrame(elements.frame);
    elements.frame = null;
  }

  #renderAnswer(elements: TurnElements, answer: string, status: TurnStatus): void {
    const element = elements.answer;
    element.hidden = answer === '' && status !== 'streaming';
    if (answer === elements.renderedAnswer) return;
    elements.renderedAnswer = answer;
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

  /** Links never navigate the Zotero window; only allowed hrefs open, in the system browser. */
  #onLinkClick(event: MouseEvent): void {
    const node = event.target as Node | null;
    const start = node?.nodeType === 1 ? (node as Element) : node?.parentElement;
    const anchor = start?.closest('a');
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute('href') ?? '';
    if (!isSafeLinkHref(href)) return;
    try {
      this.#deps.openLink(href);
    } catch (e) {
      this.#deps.logError(e);
    }
  }

  #buildModelPicker(): MenuList {
    const picker = this.#doc.createXULElement('menulist') as MenuList;
    picker.classList.add('claude-pane-model');
    const popup = this.#doc.createXULElement('menupopup');
    for (const [value, label] of MODELS) {
      const item = this.#doc.createXULElement('menuitem');
      item.setAttribute('value', value);
      item.setAttribute('label', label);
      if (value === this.#model) item.setAttribute('selected', 'true');
      popup.append(item);
    }
    picker.append(popup);
    picker.addEventListener('command', () => {
      const value = picker.selectedItem?.getAttribute('value');
      const model = MODELS.find(([alias]) => alias === value)?.[0];
      if (model) this.#model = model;
    });
    return picker;
  }

  #html<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
    const element = this.#doc.createElementNS(HTML_NS, tag) as HTMLElementTagNameMap[K];
    if (className) element.className = className;
    return element;
  }
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

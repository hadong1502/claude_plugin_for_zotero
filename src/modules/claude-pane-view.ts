// The Claude Pane's DOM (#4): one view per item pane section instance (the
// library item pane and each reader tab's context pane). It builds its own
// elements in the section body and renders the shown Thread from the Thread
// Store, so every view of one Thread stays in sync. Answers are plain text in
// #4; Markdown lands in #6.
import type { AskController } from '../core/ask-controller';
import { errorCopy } from '../core/failure';
import { itemContextFrom, type ItemLike } from '../core/item-context';
import type { ThreadStore } from '../core/thread-store';
import type { ModelAlias, ThreadKey, Turn } from '../core/types';

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
}

interface TurnElements {
  root: HTMLElement;
  question: HTMLElement;
  answer: HTMLElement;
  status: HTMLElement;
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
      for (const turn of this.#turns.values()) turn.root.remove();
      this.#turns.clear();
    }
    this.#render();
  }

  destroy(): void {
    this.#unsubscribe();
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
        elements.root.remove();
        this.#turns.delete(id);
      }
    }
    for (const turn of turns) {
      let elements = this.#turns.get(turn.id);
      if (!elements) {
        elements = this.#buildTurn();
        this.#turns.set(turn.id, elements);
      }
      this.#updateTurn(elements, turn);
      this.#thread.append(elements.root);
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
    const answer = this.#html('div', 'claude-pane-answer');
    answer.style.cssText = 'white-space: pre-wrap; overflow-wrap: anywhere;';
    const status = this.#html('div', 'claude-pane-status');
    status.style.cssText = 'white-space: pre-wrap; overflow-wrap: anywhere;';
    root.append(question, answer, status);
    return { root, question, answer, status };
  }

  #updateTurn(elements: TurnElements, turn: Turn): void {
    setText(elements.question, turn.question);
    setText(elements.answer, turn.answer === '' && turn.status === 'streaming' ? '…' : turn.answer);
    elements.answer.hidden = turn.answer === '' && turn.status !== 'streaming';

    let status = '';
    if (turn.status === 'stopped') status = errorCopy('cancelled', '');
    else if (turn.status === 'error' && turn.error) status = errorCopy(turn.error.kind, turn.error.message);
    setText(elements.status, status);
    elements.status.hidden = status === '';
    elements.status.style.color = turn.status === 'error' ? 'var(--accent-red, #d00)' : 'var(--fill-secondary)';
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

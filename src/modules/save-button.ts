// A save button for the Claude Pane and the Inline Card (#9). Pressing it is
// the only way anything is written to the library. While a save runs the
// button is disabled; afterwards it says "Saved" or "Couldn't save" for a
// moment, then shows its label again. A click never throws: failures are
// logged and shown on the button.

const FEEDBACK_MS = 2000;

export class SaveButton {
  readonly element: HTMLButtonElement;
  readonly #label: string;
  readonly #save: () => Promise<unknown>;
  readonly #logError: (e: unknown) => void;
  #enabled = true;
  #busy = false;
  #timer: number | null = null;

  /**
   * @param element an unattached button; its text becomes `label`
   * @param save writes to the library; its rejection is reported as a failure
   */
  constructor(
    element: HTMLButtonElement,
    label: string,
    save: () => Promise<unknown>,
    logError: (e: unknown) => void,
  ) {
    this.element = element;
    this.#label = label;
    this.#save = save;
    this.#logError = logError;
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', () => this.#onClick());
  }

  /** Whether a save may start; a save in progress keeps the button disabled. */
  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    this.#sync();
  }

  /** Drops any "Saved" feedback, e.g. when the button now stands for another Answer. */
  reset(): void {
    this.#clearTimer();
    if (!this.#busy) this.element.textContent = this.#label;
  }

  /** Stops the feedback timer; for when the button's view goes away. */
  dispose(): void {
    this.#clearTimer();
  }

  #onClick(): void {
    if (this.#busy || !this.#enabled) return;
    this.#busy = true;
    this.#clearTimer();
    this.#sync();
    let saving: Promise<unknown>;
    try {
      saving = Promise.resolve(this.#save());
    } catch (e) {
      saving = Promise.reject(e);
    }
    saving
      .then(
        () => this.#finish('Saved'),
        (e: unknown) => {
          this.#busy = false;
          this.#logError(e);
          this.#finish("Couldn't save");
        },
      )
      .catch(() => {
        // Only reachable if the button's document is gone; nothing to show.
      });
  }

  #finish(feedback: string): void {
    this.#busy = false;
    this.element.textContent = feedback;
    this.#sync();
    const win = this.element.ownerDocument.defaultView;
    if (!win) return;
    this.#timer = win.setTimeout(() => {
      this.#timer = null;
      this.element.textContent = this.#label;
    }, FEEDBACK_MS);
  }

  #clearTimer(): void {
    if (this.#timer === null) return;
    this.element.ownerDocument.defaultView?.clearTimeout(this.#timer);
    this.#timer = null;
  }

  #sync(): void {
    this.element.disabled = this.#busy || !this.#enabled;
  }
}

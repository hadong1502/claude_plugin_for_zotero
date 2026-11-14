// @vitest-environment happy-dom
// Save buttons (#1, #9): a press saves once, shows brief feedback, and never
// throws; failures are logged and shown.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SaveButton } from '../../src/modules/save-button';

function setup(save: () => Promise<unknown>) {
  const logError = vi.fn();
  const element = document.createElement('button');
  document.body.append(element);
  const button = new SaveButton(element, 'Save as note', save, logError);
  return { button, element, logError };
}

/** Lets the save promise and its handlers settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('SaveButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows its label', () => {
    const { element } = setup(() => Promise.resolve());
    expect(element.textContent).toBe('Save as note');
  });

  it('nothing is saved until the button is pressed', () => {
    const save = vi.fn(() => Promise.resolve());
    setup(save);
    expect(save).not.toHaveBeenCalled();
  });

  it('a press saves once and says Saved', async () => {
    const save = vi.fn(() => Promise.resolve());
    const { element } = setup(save);
    element.click();
    await settle();
    expect([save.mock.calls.length, element.textContent]).toEqual([1, 'Saved']);
  });

  it('the label comes back after the feedback', async () => {
    const { element } = setup(() => Promise.resolve());
    element.click();
    await settle();
    vi.advanceTimersByTime(2000);
    expect(element.textContent).toBe('Save as note');
  });

  it('a second press while saving does not save twice', async () => {
    let resolve: () => void = () => {};
    const save = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { element } = setup(save);
    element.click();
    element.click();
    resolve();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("a failed save is logged and says Couldn't save", async () => {
    const error = new Error('read-only library');
    const { element, logError } = setup(() => Promise.reject(error));
    element.click();
    await settle();
    expect([logError.mock.calls[0]?.[0], element.textContent]).toEqual([error, "Couldn't save"]);
  });

  it('a save that throws synchronously is reported, not thrown', async () => {
    const { element, logError } = setup(() => {
      throw new Error('boom');
    });
    expect(() => element.click()).not.toThrow();
    await settle();
    expect([logError.mock.calls.length, element.textContent]).toEqual([1, "Couldn't save"]);
  });

  it('a disabled button does not save', async () => {
    const save = vi.fn(() => Promise.resolve());
    const { button, element } = setup(save);
    button.setEnabled(false);
    element.click();
    await settle();
    expect([save.mock.calls.length, element.disabled]).toEqual([0, true]);
  });
});

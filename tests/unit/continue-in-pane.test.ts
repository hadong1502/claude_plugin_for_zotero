// Continue in Pane (#10): the question an imported Inline Card turn shows in the
// Claude Pane carries the Selection it was asked about (#1 user stories 21, 22).
import { describe, expect, it } from 'vitest';

import { continuedQuestion } from '../../src/core/continue-in-pane';

describe('continuedQuestion', () => {
  it('quotes the Selection after the question', () => {
    expect(continuedQuestion('Explain', 'the decay rate')).toBe('Explain — "the decay rate"');
  });

  it('keeps a Selection of exactly 200 characters whole', () => {
    const selection = 'a'.repeat(200);
    expect(continuedQuestion('Q', selection)).toBe(`Q — "${selection}"`);
  });

  it('truncates a longer Selection to 200 characters and an ellipsis', () => {
    expect(continuedQuestion('Q', `${'a'.repeat(200)}bcd`)).toBe(`Q — "${'a'.repeat(200)}…"`);
  });

  it('does not split a character outside the Basic Multilingual Plane', () => {
    expect(continuedQuestion('Q', `${'𝜆'.repeat(201)}`)).toBe(`Q — "${'𝜆'.repeat(200)}…"`);
  });

  it('folds the Selection line breaks and runs of spaces into single spaces', () => {
    expect(continuedQuestion('Q', '  the decay\n  rate\t λ ')).toBe('Q — "the decay rate λ"');
  });

  it('shows the question alone when the Selection is blank', () => {
    expect(continuedQuestion('Explain', ' \n ')).toBe('Explain');
  });
});

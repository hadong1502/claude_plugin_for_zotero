// Saving Answers as annotation comments (#1, #9): plain text, LaTeX kept as $...$.
import { describe, expect, it } from 'vitest';

import { toAnnotationText } from '../../src/core/answer-renderer';

describe('toAnnotationText', () => {
  it('annotation text is Q, a blank line, then the Answer', () => {
    expect(toAnnotationText(' What? ', ' It is $x$. ')).toBe('Q: What?\n\nIt is $x$.');
  });

  it('LaTeX and Markdown are kept verbatim', () => {
    const answer = '**b** $$\\frac{a}{b}$$';
    expect(toAnnotationText('Q', answer)).toContain(answer);
  });
});

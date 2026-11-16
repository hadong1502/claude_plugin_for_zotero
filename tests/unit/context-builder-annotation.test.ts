// Acceptance tests for the Context Builder's Selection layout when asking about
// an annotation (#14): the image-only Selection, a Selection with neither text
// nor picture, and the annotation's comment line.
import { describe, expect, it } from 'vitest';

import { buildQuestion } from '../../src/core/context-builder';
import type { QuestionInput, SelectionContext } from '../../src/core/types';

function input(selection: SelectionContext): QuestionInput {
  return {
    item: { title: 'T', creators: [] },
    question: 'Q?',
    selection,
    paperContext: 'none',
    aboutMe: '',
    answerLanguage: 'match',
  };
}

function textOf(built: ReturnType<typeof buildQuestion>): string {
  const block = built.content[0];
  return block.type === 'text' ? block.text : '';
}

const PICTURE_NOTE = '(A picture of the selected region is attached.)';
const NO_TEXT_NO_PICTURE = '(The selected region has no text, and its picture could not be attached.)';

describe('buildQuestion for a Selection from an annotation (#14)', () => {
  it('an image-only Selection shows the heading and picture note, with no empty quote block', () => {
    const text = textOf(buildQuestion(input({ text: '', pageLabel: '3', imagePng: 'iVBOR' })));
    expect(text).toBe(`Paper: "T".\n\nSelection (page 3):\n${PICTURE_NOTE}\n\nQuestion: Q?`);
  });

  it('an image-only Selection still attaches the picture as an image block', () => {
    const built = buildQuestion(input({ text: '', pageLabel: '3', imagePng: 'iVBOR' }));
    expect(built.content).toContainEqual({ type: 'image', mediaType: 'image/png', data: 'iVBOR' });
  });

  it('a Selection with no text and no picture says so under the heading', () => {
    const text = textOf(buildQuestion(input({ text: '  ', pageLabel: '3' })));
    expect(text).toContain(`Selection (page 3):\n${NO_TEXT_NO_PICTURE}\n\nQuestion: Q?`);
  });

  it('a comment follows the quoted text, trimmed, before the question', () => {
    const text = textOf(
      buildQuestion(input({ text: 'E=mc^2', pageLabel: '5', comment: '  check units  ' })),
    );
    expect(text).toBe(
      'Paper: "T".\n\nSelection (page 5):\n"""\nE=mc^2\n"""\nYour comment on this region: check units\n\nQuestion: Q?',
    );
  });

  it('a comment follows the picture note of an image-only Selection', () => {
    const text = textOf(
      buildQuestion(input({ text: '', pageLabel: '3', imagePng: 'iVBOR', comment: 'see fig' })),
    );
    expect(text).toContain(`${PICTURE_NOTE}\nYour comment on this region: see fig\n\nQuestion: Q?`);
  });

  it('a blank comment adds nothing', () => {
    const withBlank = textOf(buildQuestion(input({ text: 'E=mc^2', pageLabel: '5', comment: '   ' })));
    const without = textOf(buildQuestion(input({ text: 'E=mc^2', pageLabel: '5' })));
    expect(withBlank).toBe(without);
  });
});

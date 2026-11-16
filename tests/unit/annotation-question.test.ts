// Acceptance tests for asking Claude about an existing annotation (#14):
// which annotations offer Ask Claude, the Selection built from one, the
// "Add to annotation" comment-append rule and which save button a card shows.
import { describe, expect, it } from 'vitest';

import {
  annotationSelection,
  appendToComment,
  canAskAboutAnnotations,
  cardSaveButton,
  type AnnotationData,
} from '../../src/core/annotation-question';

function annotation(overrides: Partial<AnnotationData> = {}): AnnotationData {
  return {
    type: 'highlight',
    text: 'E = mc^2',
    comment: 'my note',
    pageLabel: '5',
    position: '{"pageIndex":4,"rects":[[10,20,30,40],[10,42,60,52]]}',
    key: 'ABCD1234',
    editable: true,
    ...overrides,
  };
}

describe('canAskAboutAnnotations (#14)', () => {
  it.each(['highlight', 'underline', 'image'])('offers Ask Claude for one %s in a PDF reader', (type) => {
    expect(canAskAboutAnnotations({ readerType: 'pdf', annotationTypes: [type] })).toBe(true);
  });

  it.each(['note', 'text', 'ink', 'foo'])('does not offer Ask Claude for annotation type %s', (type) => {
    expect(canAskAboutAnnotations({ readerType: 'pdf', annotationTypes: [type] })).toBe(false);
  });

  it.each(['epub', 'snapshot'])('does not offer Ask Claude in reader type %s', (readerType) => {
    expect(canAskAboutAnnotations({ readerType, annotationTypes: ['highlight'] })).toBe(false);
  });

  it('does not offer Ask Claude when no annotation is selected', () => {
    expect(canAskAboutAnnotations({ readerType: 'pdf', annotationTypes: [] })).toBe(false);
  });

  it('does not offer Ask Claude when two annotations are selected', () => {
    expect(
      canAskAboutAnnotations({ readerType: 'pdf', annotationTypes: ['highlight', 'image'] }),
    ).toBe(false);
  });
});

describe('annotationSelection (#14)', () => {
  it('a highlight keeps its text, page index, rects, label, comment, key and editable flag', () => {
    expect(annotationSelection(annotation())).toEqual({
      pageIndex: 4,
      rects: [
        [10, 20, 30, 40],
        [10, 42, 60, 52],
      ],
      text: 'E = mc^2',
      pageLabel: '5',
      comment: 'my note',
      annotationKey: 'ABCD1234',
      editable: true,
    });
  });

  it('a read-only underline keeps editable false', () => {
    expect(annotationSelection(annotation({ type: 'underline', editable: false }))?.editable).toBe(
      false,
    );
  });

  it('an Area Annotation gives empty text even when its text field holds something', () => {
    expect(annotationSelection(annotation({ type: 'image', text: 'junk' }))?.text).toBe('');
  });

  it.each([
    ['invalid JSON', '{"pageIndex":4,"rects":'],
    ['a missing rects', '{"pageIndex":4}'],
    ['empty rects', '{"pageIndex":4,"rects":[]}'],
    ['a rect of 3 numbers', '{"pageIndex":4,"rects":[[1,2,3]]}'],
    ['a NaN in a rect (JSON serializes NaN as null)', JSON.stringify({ pageIndex: 4, rects: [[1, 2, NaN, 4]] })],
    ['a string in a rect', '{"pageIndex":4,"rects":[[1,2,"3",4]]}'],
    ['an infinite number in a rect', '{"pageIndex":4,"rects":[[1,2,1e999,4]]}'],
    ['pageIndex -1', '{"pageIndex":-1,"rects":[[1,2,3,4]]}'],
    ['pageIndex 1.5', '{"pageIndex":1.5,"rects":[[1,2,3,4]]}'],
  ])('an unusable position gives null: %s', (_label, position) => {
    expect(annotationSelection(annotation({ position }))).toBeNull();
  });

  it('extra position fields are ignored', () => {
    const position =
      '{"pageIndex":2,"rects":[[1,2,3,4]],"rotation":90,"nextPageRects":[[5,6,7,8]]}';
    expect(annotationSelection(annotation({ position }))).toEqual({
      pageIndex: 2,
      rects: [[1, 2, 3, 4]],
      text: 'E = mc^2',
      pageLabel: '5',
      comment: 'my note',
      annotationKey: 'ABCD1234',
      editable: true,
    });
  });
});

describe('appendToComment (#14)', () => {
  it('an empty comment becomes the addition, with no leading blank line', () => {
    expect(appendToComment('', 'Q: a\n\nb')).toBe('Q: a\n\nb');
  });

  it('a whitespace-only comment becomes the addition', () => {
    expect(appendToComment('   ', 'x')).toBe('x');
  });

  it('an existing comment loses its trailing whitespace and gains a blank line before the addition', () => {
    expect(appendToComment('note\n', 'x')).toBe('note\n\nx');
  });

  it('appending twice keeps both blocks in order', () => {
    expect(appendToComment(appendToComment('note', 'x'), 'y')).toBe('note\n\nx\n\ny');
  });
});

describe('cardSaveButton (#14)', () => {
  it('a fresh highlight (no annotation key) shows Save as annotation', () => {
    expect(cardSaveButton({})).toBe('save-as-annotation');
  });

  it('an empty annotation key counts as a fresh highlight', () => {
    expect(cardSaveButton({ annotationKey: '', editable: true })).toBe('save-as-annotation');
  });

  it('an editable annotation shows Add to annotation', () => {
    expect(cardSaveButton({ annotationKey: 'ABCD1234', editable: true })).toBe('add-to-annotation');
  });

  it('a read-only annotation shows no save-to-PDF button', () => {
    expect(cardSaveButton({ annotationKey: 'ABCD1234', editable: false })).toBe('none');
  });

  it('an annotation without an editable flag shows no save-to-PDF button', () => {
    expect(cardSaveButton({ annotationKey: 'ABCD1234' })).toBe('none');
  });
});

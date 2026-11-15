// What may be saved, and the highlight a Saved Annotation becomes (#1, #9).
import { describe, expect, it } from 'vitest';

import { highlightJson, isSaveableTurn, saveableTurns } from '../../src/core/saving';
import type { Turn } from '../../src/core/types';

function turn(id: string, status: Turn['status'], answer: string): Turn {
  return { id, question: `q${id}`, answer, model: 'sonnet', status, source: 'pane' };
}

describe('isSaveableTurn', () => {
  it('a done turn is saveable', () => {
    expect(isSaveableTurn(turn('1', 'done', 'A'))).toBe(true);
  });

  it('a stopped turn with an Answer is saveable', () => {
    expect(isSaveableTurn(turn('1', 'stopped', 'partial'))).toBe(true);
  });

  it('a stopped turn without an Answer is not saveable', () => {
    expect(isSaveableTurn(turn('1', 'stopped', '  \n'))).toBe(false);
  });

  it('a streaming turn is not saveable', () => {
    expect(isSaveableTurn(turn('1', 'streaming', 'so far'))).toBe(false);
  });

  it('an error turn is not saveable, even with text', () => {
    expect(isSaveableTurn(turn('1', 'error', 'partial'))).toBe(false);
  });
});

describe('saveableTurns', () => {
  it('keeps saveable turns in order and drops the rest', () => {
    const turns = [
      turn('1', 'done', 'a'),
      turn('2', 'error', 'b'),
      turn('3', 'stopped', 'c'),
      turn('4', 'stopped', ''),
      turn('5', 'done', 'e'),
      turn('6', 'streaming', 'f'),
    ];
    expect(saveableTurns(turns).map((t) => t.id)).toEqual(['1', '3', '5']);
  });
});

describe('highlightJson', () => {
  const selection = {
    type: 'highlight',
    color: '#a28ae5',
    sortIndex: '00003|001234|00567',
    pageLabel: '4',
    position: { pageIndex: 3, rects: [[1, 2, 3, 4]] },
    text: 'the passage',
  };

  it('is a highlight on the Selection with the key and comment', () => {
    expect(highlightJson(selection, 'ABCD2345', 'Q: x\n\ny')).toEqual({
      key: 'ABCD2345',
      type: 'highlight',
      color: '#a28ae5',
      sortIndex: '00003|001234|00567',
      pageLabel: '4',
      position: { pageIndex: 3, rects: [[1, 2, 3, 4]] },
      text: 'the passage',
      comment: 'Q: x\n\ny',
    });
  });

  it("uses Zotero's default highlight colour when none was captured", () => {
    expect(highlightJson({ ...selection, color: undefined }, 'K', 'c').color).toBe('#ffd400');
  });

  it('is always a highlight, whatever annotation type the popup offered', () => {
    expect(highlightJson({ ...selection, type: 'underline' }, 'K', 'c').type).toBe('highlight');
  });
});

// The Selection marker (#1 user stories 13-14, #11 manual run): while the
// Inline Card is open, the reader has cleared its own highlight, so the card
// draws the Selection's lines itself, clipped to the visible PDF view.
import { describe, expect, it } from 'vitest';
import { visibleMarks } from '../../src/core/card-placement';

const view = { left: 0, top: 100, right: 500, bottom: 700 };

describe('visibleMarks', () => {
  it('a line inside the view is kept as it is', () => {
    expect(visibleMarks([{ left: 10, top: 200, right: 300, bottom: 215 }], view)).toEqual([
      { left: 10, top: 200, right: 300, bottom: 215 },
    ]);
  });

  it('a line partly under the toolbar is cut at the view edge', () => {
    expect(visibleMarks([{ left: 10, top: 90, right: 300, bottom: 110 }], view)).toEqual([
      { left: 10, top: 100, right: 300, bottom: 110 },
    ]);
  });

  it('a line scrolled out of the view is dropped', () => {
    expect(visibleMarks([{ left: 10, top: 710, right: 300, bottom: 725 }], view)).toEqual([]);
  });

  it('an empty line is dropped', () => {
    expect(visibleMarks([{ left: 10, top: 200, right: 10, bottom: 215 }], view)).toEqual([]);
  });

  it('lines keep their order', () => {
    const lines = [
      { left: 10, top: 200, right: 300, bottom: 215 },
      { left: 10, top: 216, right: 120, bottom: 231 },
    ];
    expect(visibleMarks(lines, view)).toEqual(lines);
  });
});

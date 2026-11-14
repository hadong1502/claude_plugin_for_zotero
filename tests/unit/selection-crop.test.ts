// Selection Snapshot crop geometry (#1, #8).
// Scales are compared with toBeCloseTo(x, 9): tolerance 1e-9, because they come from float division.
import { describe, expect, it } from 'vitest';

import { selectionCropBox } from '../../src/core/selection-crop';

describe('selectionCropBox', () => {
  it('one rect is padded by 4 points', () => {
    expect(selectionCropBox([[100, 200, 300, 220]])?.box).toEqual([96, 196, 304, 224]);
  });

  it('the default scale is 200 dpi', () => {
    expect(selectionCropBox([[100, 200, 300, 220]])?.scale).toBeCloseTo(200 / 72, 9);
  });

  it('several rects are united', () => {
    const rects = [
      [100, 200, 300, 220],
      [90, 180, 250, 198],
    ];
    expect(selectionCropBox(rects)?.box).toEqual([86, 176, 304, 224]);
  });

  it('large regions are capped at 2000 pixels on the longest side', () => {
    expect(selectionCropBox([[0, 0, 1000, 100]])?.scale).toBeCloseTo(2000 / 1008, 9);
  });

  it('no rects gives null', () => {
    expect(selectionCropBox([])).toBeNull();
  });

  it('a zero-area union gives null', () => {
    expect(selectionCropBox([[5, 5, 5, 5]], { paddingPt: 0 })).toBeNull();
  });

  it('options override the defaults', () => {
    expect(selectionCropBox([[100, 200, 300, 220]], { paddingPt: 0, dpi: 72 })).toEqual({
      box: [100, 200, 300, 220],
      scale: 1,
    });
  });
});

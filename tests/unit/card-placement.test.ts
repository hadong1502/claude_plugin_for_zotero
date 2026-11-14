// Inline Card placement (#7): the card sits next to the Selection inside the
// reader view, on the side with more room, and hides while the Selection is
// scrolled out of the view (#1 user stories 13, 14). Expected values are
// worked by hand from the inputs.
import { describe, expect, it } from 'vitest';

import { placeCard } from '../../src/core/card-placement';

const VIEW = { left: 0, top: 100, right: 800, bottom: 700 };
const SIZE = { width: 320, gap: 8, minHeight: 120, maxHeight: 420 };

describe('placeCard', () => {
  it('goes below a Selection near the top, left-aligned with it', () => {
    const anchor = { left: 100, top: 150, right: 300, bottom: 170 };
    expect(placeCard(anchor, VIEW, SIZE)).toEqual({
      visible: true,
      side: 'below',
      left: 100,
      y: 178,
      maxHeight: 420,
    });
  });

  it('goes above a Selection near the bottom; y is then the card bottom edge', () => {
    const anchor = { left: 100, top: 600, right: 300, bottom: 620 };
    // Room above: 600 - 100 - 2*8 = 484, capped at 420.
    expect(placeCard(anchor, VIEW, SIZE)).toEqual({
      visible: true,
      side: 'above',
      left: 100,
      y: 592,
      maxHeight: 420,
    });
  });

  it('limits the height to the room on the chosen side', () => {
    const anchor = { left: 100, top: 380, right: 300, bottom: 400 };
    // Below: 700 - 400 - 16 = 284; above: 380 - 100 - 16 = 264.
    expect(placeCard(anchor, VIEW, SIZE)).toMatchObject({ side: 'below', maxHeight: 284 });
  });

  it('keeps the card inside the view horizontally', () => {
    const anchor = { left: 700, top: 150, right: 780, bottom: 170 };
    // 800 - 320 - 8 = 472.
    expect(placeCard(anchor, VIEW, SIZE).left).toBe(472);
  });

  it('never starts left of the view', () => {
    const anchor = { left: -50, top: 150, right: 40, bottom: 170 };
    expect(placeCard(anchor, VIEW, SIZE).left).toBe(8);
  });

  it('keeps the minimum height when the room is smaller, shifting into the view', () => {
    const view = { left: 0, top: 100, right: 800, bottom: 300 };
    const anchor = { left: 100, top: 190, right: 300, bottom: 210 };
    // Below: 300 - 210 - 16 = 74 < 120, so the card is 120 tall and its top
    // moves up to 300 - 8 - 120 = 172.
    expect(placeCard(anchor, view, SIZE)).toMatchObject({
      side: 'below',
      y: 172,
      maxHeight: 120,
    });
  });

  it('hides while the Selection is scrolled out of the view', () => {
    const anchor = { left: 100, top: 20, right: 300, bottom: 60 };
    expect(placeCard(anchor, VIEW, SIZE).visible).toBe(false);
  });
});

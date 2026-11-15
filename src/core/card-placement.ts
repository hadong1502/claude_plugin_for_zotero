// Inline Card placement (#7), pure: where the card goes next to the Selection
// inside the reader view. The card takes the side (below or above the
// Selection) with more room, so it does not jump sides as the Answer grows,
// and is hidden while the Selection is scrolled out of the view.

/** A rectangle in client coordinates. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CardSize {
  width: number;
  /** Space kept between the card, the Selection and the view's edges. */
  gap: number;
  minHeight: number;
  maxHeight: number;
}

export interface CardPlacement {
  /** False while the Selection is entirely outside the view. */
  visible: boolean;
  side: 'below' | 'above';
  left: number;
  /** The card's top edge when below the Selection, its bottom edge when above. */
  y: number;
  maxHeight: number;
}

export function placeCard(anchor: Box, view: Box, size: CardSize): CardPlacement {
  const { width, gap, minHeight, maxHeight } = size;
  const visible =
    anchor.bottom > view.top &&
    anchor.top < view.bottom &&
    anchor.right > view.left &&
    anchor.left < view.right;

  const left = Math.max(Math.min(anchor.left, view.right - width - gap), view.left + gap);

  const roomBelow = view.bottom - anchor.bottom - 2 * gap;
  const roomAbove = anchor.top - view.top - 2 * gap;
  const side = roomBelow >= roomAbove ? 'below' : 'above';
  const room = side === 'below' ? roomBelow : roomAbove;
  const height = Math.max(Math.min(room, maxHeight), minHeight);

  // When the room is smaller than the minimum height, shift the card back
  // into the view, over the Selection if need be.
  const y =
    side === 'below'
      ? Math.min(anchor.bottom + gap, view.bottom - gap - height)
      : Math.max(anchor.top - gap, view.top + gap + height);

  return { visible, side, left, y, maxHeight: height };
}

/**
 * The Selection's lines as drawn while the Inline Card is open: each cut to
 * the visible view, and dropped when nothing of it shows (#1, #11).
 */
export function visibleMarks(lines: Box[], view: Box): Box[] {
  const marks: Box[] = [];
  for (const line of lines) {
    const mark = {
      left: Math.max(line.left, view.left),
      top: Math.max(line.top, view.top),
      right: Math.min(line.right, view.right),
      bottom: Math.min(line.bottom, view.bottom),
    };
    if (mark.right > mark.left && mark.bottom > mark.top) marks.push(mark);
  }
  return marks;
}

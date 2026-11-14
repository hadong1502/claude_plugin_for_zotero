// Crop geometry for the Selection Snapshot (#1, #8). Rects are PDF user-space [x1, y1, x2, y2].
export function selectionCropBox(
  _rects: number[][],
  _o?: { paddingPt?: number; dpi?: number; maxSidePx?: number },
): { box: [number, number, number, number]; scale: number } | null {
  throw new Error('not implemented (#8)');
}

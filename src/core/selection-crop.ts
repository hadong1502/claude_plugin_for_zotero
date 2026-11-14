// Crop geometry for the Selection Snapshot (#1, #8). Rects are PDF user-space [x1, y1, x2, y2].

/** Points per inch in PDF user space. */
const PT_PER_INCH = 72;

/**
 * The region of the page to render for a Selection: the union of its rects,
 * padded by `paddingPt` on every side, and the pdf.js scale to render it at:
 * `dpi` (high enough for equations), lowered so the longest side stays within
 * `maxSidePx`. Null for no rects, or a union without area (including
 * non-finite coordinates).
 */
export function selectionCropBox(
  rects: number[][],
  o: { paddingPt?: number; dpi?: number; maxSidePx?: number } = {},
): { box: [number, number, number, number]; scale: number } | null {
  const { paddingPt = 4, dpi = 200, maxSidePx = 2000 } = o;
  if (rects.length === 0) return null;
  let [x1, y1, x2, y2] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [a, b, c, d] of rects) {
    x1 = Math.min(x1, a, c);
    y1 = Math.min(y1, b, d);
    x2 = Math.max(x2, a, c);
    y2 = Math.max(y2, b, d);
  }
  const box: [number, number, number, number] = [x1 - paddingPt, y1 - paddingPt, x2 + paddingPt, y2 + paddingPt];
  const width = box[2] - box[0];
  const height = box[3] - box[1];
  // Written so NaN also fails.
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return null;
  const scale = Math.min(dpi / PT_PER_INCH, maxSidePx / Math.max(width, height));
  return { box, scale };
}

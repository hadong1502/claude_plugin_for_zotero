// The Selection Snapshot (#1, #8): a PNG of the Selection's region of its PDF
// page, sent with Inline Questions so Claude sees equations and figures as
// they are typeset. The geometry is pure (core/selection-crop.ts); this module
// only drives pdf.js. Any failure (no page index, a reader that is not a PDF,
// a missing pdf.js document, a timeout) gives undefined, and the question is
// sent text-only.
//
// Reader internals used here (Zotero 10.0.8): `reader._internalReader._primaryView`
// is the PDF view even while Reading Mode overlays it, and its
// `_iframeWindow.PDFViewerApplication.pdfDocument` is the pdf.js document
// (xpcom/reader.js reaches pdf.js the same way). pdf.js is content code: every
// object it reads must be created in its window, never passed from the plugin.
import { selectionCropBox } from '../core/selection-crop';

const DEFAULT_TIMEOUT_MS = 3000;
const PNG_PREFIX = 'data:image/png;base64,';

interface ViewportLike {
  convertToViewportPoint(x: number, y: number): ArrayLike<number>;
}

interface RenderTaskLike {
  promise: Promise<unknown>;
  cancel(): void;
}

interface PdfPageLike {
  getViewport(options: object): ViewportLike;
  render(params: object): RenderTaskLike;
}

interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

interface PdfWindowLike {
  document: Document;
  PDFViewerApplication?: { pdfDocument?: PdfDocumentLike | null } | null;
}

interface ReaderLike {
  type?: unknown;
  _internalReader?: { _primaryView?: { _iframeWindow?: unknown } | null } | null;
}

/**
 * Renders the crop box of `rects` on page `pageIndex` (0-based) and resolves
 * its base64 PNG data, without the `data:` prefix. Resolves undefined on any
 * error, or once `timeoutMs` has passed; never rejects.
 */
export function snapshotSelection(
  reader: unknown,
  pageIndex: number,
  rects: number[][],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    let done = false;
    let task: RenderTaskLike | null = null;
    const finish = (png: string | undefined) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(png);
    };
    const timer = setTimeout(() => {
      finish(undefined);
      // The render's own rejection is handled below; its canvas is released there.
      try {
        task?.cancel();
      } catch (e) {
        logError(e);
      }
    }, timeoutMs);
    render(reader as ReaderLike, pageIndex, rects, {
      onTask: (t) => (task = t),
      isOver: () => done,
    }).then(finish, (e: unknown) => {
      // A cancelled render after a timeout is expected, not an error.
      if (!done) logError(e);
      finish(undefined);
    });
  });
}

async function render(
  reader: ReaderLike,
  pageIndex: number,
  rects: number[][],
  run: { onTask(task: RenderTaskLike): void; isOver(): boolean },
): Promise<string | undefined> {
  if (reader?.type !== 'pdf' || !Number.isInteger(pageIndex) || pageIndex < 0) return undefined;
  const crop = selectionCropBox(rects);
  const frame = reader._internalReader?._primaryView?._iframeWindow;
  if (!crop || !frame) return undefined;
  const win = Components.utils.waiveXrays(frame) as PdfWindowLike;
  const pdfDocument = win.PDFViewerApplication?.pdfDocument;
  if (!pdfDocument || pageIndex >= pdfDocument.numPages) return undefined;
  // A content promise's value arrives here Xray-wrapped again, which hides
  // pdf.js's prototype methods (getViewport); waive it too.
  const page = Components.utils.waiveXrays(await pdfDocument.getPage(pageIndex + 1)) as PdfPageLike;
  if (run.isOver()) return undefined;

  // The box in canvas pixels at the crop's scale; min/max covers page rotation.
  const { box, scale } = crop;
  const full = page.getViewport(toContent(win, { scale }));
  const a = full.convertToViewportPoint(box[0], box[1]);
  const b = full.convertToViewportPoint(box[2], box[3]);
  const left = Math.min(a[0], b[0]);
  const top = Math.min(a[1], b[1]);
  const width = Math.ceil(Math.abs(b[0] - a[0]));
  const height = Math.ceil(Math.abs(b[1] - a[1]));
  if (!(width > 0 && height > 0)) return undefined;
  // Offset so the box renders at the canvas origin.
  const viewport = page.getViewport(toContent(win, { scale, offsetX: -left, offsetY: -top }));

  const canvas = win.document.createElement('canvas');
  try {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return undefined;
    // The page as printed, not recoloured by the reader's theme, as the reader's own crops do.
    (ctx as CanvasRenderingContext2D & { skipBlender?: boolean }).skipBlender = true;
    const task = page.render(toContent(win, { canvasContext: ctx, viewport }));
    run.onTask(task);
    await task.promise;
    if (run.isOver()) return undefined;
    const url = canvas.toDataURL('image/png');
    return url.startsWith(PNG_PREFIX) && url.length > PNG_PREFIX.length ? url.slice(PNG_PREFIX.length) : undefined;
  } finally {
    // Zeroing both dimensions frees the canvas memory at once (as pdf.js does).
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** A plain object made in pdf.js's window, so pdf.js can read its properties. */
function toContent<T extends object>(win: PdfWindowLike, values: T): T {
  const target = Components.utils.waiveXrays(Components.utils.cloneInto({}, win)) as T;
  return Object.assign(target, values);
}

function logError(e: unknown): void {
  Zotero.logError(e instanceof Error ? e : new Error(String(e)));
}

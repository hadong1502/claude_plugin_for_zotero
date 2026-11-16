// Pure rules for asking Claude about an existing annotation (#14): which
// annotations offer Ask Claude, the Selection built from one, how "Add to
// annotation" appends to its comment, and which save button a card shows.

/** The fields of a Zotero annotation item that the plugin reads. */
export interface AnnotationData {
  /** Zotero annotationType: 'highlight' | 'underline' | 'image' | 'note' | 'text' | 'ink' | ... */
  type: string;
  /** annotationText ('' for images). */
  text: string;
  /** annotationComment ('' when none). */
  comment: string;
  /** annotationPageLabel. */
  pageLabel: string;
  /** annotationPosition, a JSON string like '{"pageIndex":2,"rects":[[1,2,3,4]]}'. */
  position: string;
  /** The annotation item's key. */
  key: string;
  /** False for read-only libraries and annotations imported from the file. */
  editable: boolean;
}

/** The Selection an Inline Card asks about when opened from an annotation. */
export interface AnnotationSelection {
  pageIndex: number;
  rects: number[][];
  text: string;
  pageLabel: string;
  comment: string;
  annotationKey: string;
  editable: boolean;
}

/** Annotation types with a passage or region to ask about (#14). */
const ASKABLE_TYPES = new Set(['highlight', 'underline', 'image']);

/** Whether the annotation context menu offers Ask Claude: one highlight, underline or Area Annotation in a PDF. */
export function canAskAboutAnnotations(o: { readerType: string; annotationTypes: string[] }): boolean {
  return o.readerType === 'pdf' && o.annotationTypes.length === 1 && ASKABLE_TYPES.has(o.annotationTypes[0]!);
}

/** The Selection an Inline Card asks about, from one annotation; null when its position is unusable. */
export function annotationSelection(a: AnnotationData): AnnotationSelection | null {
  let position: unknown;
  try {
    position = JSON.parse(a.position);
  } catch {
    return null;
  }
  if (!position || typeof position !== 'object') return null;
  const { pageIndex, rects } = position as { pageIndex?: unknown; rects?: unknown };
  if (typeof pageIndex !== 'number' || !Number.isInteger(pageIndex) || pageIndex < 0) return null;
  if (!Array.isArray(rects) || rects.length === 0) return null;
  const isRect = (r: unknown): r is number[] =>
    Array.isArray(r) && r.length === 4 && r.every((n) => typeof n === 'number' && Number.isFinite(n));
  if (!rects.every(isRect)) return null;
  return {
    pageIndex,
    rects: rects.map((r) => [...r]),
    // An Area Annotation is a picture only; any text Zotero holds for it is ignored.
    text: a.type === 'image' ? '' : a.text,
    pageLabel: a.pageLabel,
    comment: a.comment,
    annotationKey: a.key,
    editable: a.editable,
  };
}

/** The annotation comment after "Add to annotation" appends `addition`, below what is there. */
export function appendToComment(existing: string, addition: string): string {
  if (existing.trim() === '') return addition;
  return `${existing.replace(/\s+$/, '')}\n\n${addition}`;
}

export type CardSaveButton = 'save-as-annotation' | 'add-to-annotation' | 'none';

/**
 * Which save-to-PDF button a card shows under a finished Answer: a fresh
 * highlight gets a new Saved Annotation; an annotation the card was opened
 * from gets the Q&A appended, unless it is read-only.
 */
export function cardSaveButton(source: { annotationKey?: string; editable?: boolean }): CardSaveButton {
  if (!source.annotationKey) return 'save-as-annotation';
  return source.editable ? 'add-to-annotation' : 'none';
}

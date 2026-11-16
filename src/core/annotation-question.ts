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

/** Whether the annotation context menu offers Ask Claude. */
export function canAskAboutAnnotations(_o: {
  readerType: string;
  annotationTypes: string[];
}): boolean {
  throw new Error('not implemented (#14)');
}

/** The Selection an Inline Card asks about, from one annotation; null when its position is unusable. */
export function annotationSelection(_a: AnnotationData): AnnotationSelection | null {
  throw new Error('not implemented (#14)');
}

/** The annotation comment after "Add to annotation" appends `addition`. */
export function appendToComment(_existing: string, _addition: string): string {
  throw new Error('not implemented (#14)');
}

export type CardSaveButton = 'save-as-annotation' | 'add-to-annotation' | 'none';

/** Which save-to-PDF button a card shows under a finished Answer. */
export function cardSaveButton(_source: { annotationKey?: string; editable?: boolean }): CardSaveButton {
  throw new Error('not implemented (#14)');
}

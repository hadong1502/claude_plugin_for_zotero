// Saving rules (#1, #9), pure: which turns may be saved, and the highlight
// JSON a Saved Annotation is created from.
import type { Turn } from './types';

/** Zotero's default highlight colour (the reader's yellow). */
export const DEFAULT_HIGHLIGHT_COLOR = '#ffd400';

/** A finished Answer, or a stopped one that got some text; never a failed or streaming one. */
export function isSaveableTurn(turn: Pick<Turn, 'status' | 'answer'>): boolean {
  return turn.status === 'done' || (turn.status === 'stopped' && turn.answer.trim() !== '');
}

/** The turns a Thread note holds, in order. */
export function saveableTurns<T extends Pick<Turn, 'status' | 'answer'>>(turns: readonly T[]): T[] {
  return turns.filter(isSaveableTurn);
}

/**
 * The Selection as the reader's text-selection popup described it
 * (`params.annotation`), captured when the Ask Claude Button was pressed.
 */
export interface SelectionAnnotation {
  type?: string;
  color?: string;
  sortIndex?: string;
  pageLabel?: string;
  /** The reader's position object (`{ pageIndex, rects, ... }` for PDFs). */
  position: unknown;
  text?: string;
}

/** The JSON for `Zotero.Annotations.saveFromJSON`: a highlight on the Selection with `comment`. */
export function highlightJson(
  selection: SelectionAnnotation,
  key: string,
  comment: string,
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    key,
    type: 'highlight',
    color: selection.color || DEFAULT_HIGHLIGHT_COLOR,
    position: selection.position,
    comment,
  };
  if (selection.sortIndex !== undefined) json.sortIndex = selection.sortIndex;
  if (selection.pageLabel !== undefined) json.pageLabel = selection.pageLabel;
  if (selection.text !== undefined) json.text = selection.text;
  return json;
}

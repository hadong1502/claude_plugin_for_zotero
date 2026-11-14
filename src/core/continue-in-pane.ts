// Continue in Pane (#10): the question an imported Inline Card turn shows in the
// Claude Pane. It carries the Selection, so the Thread shows what was asked about.
import type { ModelAlias } from './types';

/** An Inline Card exchange to carry into the item's Thread. */
export interface ContinuedExchange {
  question: string;
  answer: string;
  model: ModelAlias;
  /** The Inline Question's CLI session, if it finished with one. */
  sessionId?: string;
}

/** Longest Selection quoted in full, in characters (code points). */
const SELECTION_LIMIT = 200;

/**
 * `question — "selection"`, with the Selection's whitespace folded to single
 * spaces and anything past 200 characters replaced by `…`. A blank Selection
 * leaves the question alone.
 */
export function continuedQuestion(question: string, selectionText: string): string {
  const selection = selectionText.replace(/\s+/g, ' ').trim();
  if (selection === '') return question;
  const chars = Array.from(selection);
  const quoted =
    chars.length > SELECTION_LIMIT ? `${chars.slice(0, SELECTION_LIMIT).join('')}…` : selection;
  return `${question} — "${quoted}"`;
}

import { notImplemented } from './not-implemented';

/**
 * Parses renderer output as HTML in a detached document and returns it as a
 * fragment owned by `doc`, after stripping anything dangerous (#1, #6).
 */
export function htmlToFragment(_doc: Document, _html: string): DocumentFragment {
  return notImplemented('htmlToFragment', '#6');
}

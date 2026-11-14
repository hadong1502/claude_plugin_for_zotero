// Answer Renderer (pure). Display HTML lands in #6; note HTML and annotation
// text in #9.
import { notImplemented } from './not-implemented';

/** Markdown with LaTeX math to sanitised display HTML. */
export function renderAnswerHtml(markdown: string): string {
  void markdown;
  return notImplemented('renderAnswerHtml', '#6');
}

/** Question and Answer pairs to Zotero note HTML, with math in Zotero's format. */
export function toNoteHtml(turns: Array<{ question: string; answer: string }>): string {
  void turns;
  return notImplemented('toNoteHtml', '#9');
}

/** A question and its Answer to plain annotation-comment text. */
export function toAnnotationText(question: string, answer: string): string {
  void [question, answer];
  return notImplemented('toAnnotationText', '#9');
}

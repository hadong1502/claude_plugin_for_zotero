// Answer Renderer (pure). Display HTML lands in #6; note HTML and annotation
// text in #9.
import MarkdownIt from 'markdown-it';

import { markdownMath } from './markdown-math';
import { notImplemented } from './not-implemented';
import { isSafeLinkHref } from './safe-link';

// Created once so later plugins (math, #6) extend the same instance.
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
  xhtmlOut: true,
});
md.validateLink = isSafeLinkHref;
md.disable('image');
md.use(markdownMath);

/** Markdown with LaTeX math to sanitised display HTML. */
export function renderAnswerHtml(markdown: string): string {
  return md.render(markdown);
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

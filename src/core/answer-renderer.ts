// Answer Renderer (pure): turns an Answer's Markdown and math into display
// HTML, into Zotero note HTML, and into plain annotation text.
import MarkdownIt from 'markdown-it';

import { markdownMath, zoteroNoteMath } from './markdown-math';
import { isSafeLinkHref } from './safe-link';

/** The Markdown rules every Answer is rendered with: raw HTML escaped, safe links only, no images. */
function createMarkdown(): MarkdownIt {
  const instance = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    breaks: false,
    xhtmlOut: true,
  });
  instance.validateLink = isSafeLinkHref;
  instance.disable('image');
  return instance;
}

// Created once each: display HTML typesets math with KaTeX (#6); note HTML
// keeps the same Markdown and delimiter rules (#9).
const md = createMarkdown().use(markdownMath);
const noteMd = createMarkdown().use(markdownMath, { render: zoteroNoteMath });

/** Markdown with LaTeX math to sanitised display HTML. */
export function renderAnswerHtml(markdown: string): string {
  return md.render(markdown);
}

/** Question and Answer pairs to Zotero note HTML, with math in Zotero's format. */
export function toNoteHtml(turns: Array<{ question: string; answer: string }>): string {
  return turns
    // The line break keeps the question and the Answer apart in Zotero's note
    // preview, which splits the stored HTML on line breaks.
    .map(({ question, answer }) => `${questionHeading(question)}\n${noteMd.render(answer)}`)
    .join('<hr/>');
}

/** A question and its Answer to plain annotation-comment text. */
export function toAnnotationText(question: string, answer: string): string {
  return `Q: ${question.trim()}\n\n${answer.trim()}`;
}

function questionHeading(question: string): string {
  const text = noteMd.utils.escapeHtml(question.trim()).replace(/\r?\n/g, '<br/>');
  // A gray, left-aligned Heading 1, so each question reads as a section title in the note.
  return `<h1 style="text-align: left"><span style="color: #808080">Question: ${text}</span></h1>`;
}

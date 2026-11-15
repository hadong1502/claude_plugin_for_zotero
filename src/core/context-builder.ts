// Context Builder (pure): turns a question into prompt content and a
// readable-file allowlist. Item Context, About me and language land in #4,
// Quick Actions and the Selection in #7, Paper Context modes and the Selection
// picture in #8, the Continue in Pane prior exchange in #10.
import type { BuiltQuestion, ContentBlock, QuestionInput, QuickAction } from './types';

export const BASE_SYSTEM_PROMPT =
  'You help a researcher read academic papers inside Zotero. Answer concisely in Markdown. Write math in LaTeX with $...$ for inline and $$...$$ for display.';

export const QUICK_ACTION_WORDINGS: Readonly<Record<QuickAction, string>> = {
  explain: 'Explain this passage in plain language.',
  define: 'Define this term or notation as it is used in this paper. Be brief.',
  'explain-math':
    'Explain the math in this passage. First restate the equation in LaTeX, then explain what each part means and how it follows.',
};

// Paper Context prompt copy and limits (#8).
export const PAPER_READ_WHEN_NEEDED = (pdfPath: string): string =>
  `The paper's PDF is at ${pdfPath}. Read it with the Read tool only if the question needs the paper's content beyond what is given here.`;

export const PAPER_READ_FIRST = (pdfPath: string): string =>
  `The paper's PDF is at ${pdfPath}. Read it with the Read tool before answering, and base your Answer on it.`;

// The paper's text file, alone or with the PDF (#11 manual run): Read handles
// text anywhere, but PDF pages need poppler, so the text file is read first.
export const PAPER_TEXT_WHEN_NEEDED = (textPath: string, pdfPath?: string): string =>
  pdfPath === undefined
    ? `The paper's text, extracted from its PDF, is at ${textPath}. Read it with the Read tool only if the question needs the paper's content beyond what is given here.`
    : `The paper's text, extracted from its PDF, is at ${textPath}, and the PDF itself is at ${pdfPath}. Read the text file with the Read tool only if the question needs the paper's content beyond what is given here. Read pages of the PDF only when you need to see an equation, figure or table as typeset.`;

export const PAPER_TEXT_FIRST = (textPath: string, pdfPath?: string): string =>
  pdfPath === undefined
    ? `The paper's text, extracted from its PDF, is at ${textPath}. Read it with the Read tool before answering, and base your Answer on it.`
    : `The paper's text, extracted from its PDF, is at ${textPath}, and the PDF itself is at ${pdfPath}. Read the text file with the Read tool before answering, and base your Answer on it. Read pages of the PDF when you need to see an equation, figure or table as typeset.`;

export const PAPER_TEXT_INCLUDED =
  "The paper's full text, extracted from its PDF, is included in the message. Base your Answer on it.";

export const EXTRACTED_TEXT_LIMIT = 150000;

export const SELECTION_PICTURE_NOTE = '(A picture of the selected region is attached.)';

export function buildQuestion(input: QuestionInput): BuiltQuestion {
  const parts = [BASE_SYSTEM_PROMPT];
  const aboutMe = input.aboutMe.trim();
  if (aboutMe) parts.push(`About the reader: ${aboutMe}`);
  const language = input.answerLanguage.trim();
  parts.push(
    language === '' || language === 'match'
      ? 'Answer in the language of the question.'
      : `Answer in ${language}.`,
  );

  // Paper Context (#8): inline extracted text wins over the readable files (the
  // paper's text file, then the PDF, #11); a mode with none behaves as 'none'.
  const { paperContext } = input;
  const pdfPath = input.pdfPath === '' ? undefined : input.pdfPath;
  const textPath = input.textPath === '' ? undefined : input.textPath;
  const hasText = input.extractedText !== undefined && input.extractedText !== '';
  let paperText: string | undefined;
  let readableFiles: string[] = [];
  if (paperContext !== 'none' && hasText) {
    const full = input.extractedText as string;
    paperText =
      full.length > EXTRACTED_TEXT_LIMIT
        ? `${full.slice(0, EXTRACTED_TEXT_LIMIT)}\n[…truncated]`
        : full;
    parts.push(PAPER_TEXT_INCLUDED);
  } else if (paperContext !== 'none' && textPath !== undefined) {
    readableFiles = pdfPath === undefined ? [textPath] : [textPath, pdfPath];
    parts.push(
      paperContext === 'forced'
        ? PAPER_TEXT_FIRST(textPath, pdfPath)
        : PAPER_TEXT_WHEN_NEEDED(textPath, pdfPath),
    );
  } else if (paperContext !== 'none' && pdfPath !== undefined) {
    readableFiles = [pdfPath];
    parts.push(
      paperContext === 'forced' ? PAPER_READ_FIRST(pdfPath) : PAPER_READ_WHEN_NEEDED(pdfPath),
    );
  }

  const { item } = input;
  let paper = `Paper: "${item.title || 'Untitled'}"`;
  if (item.year) paper += ` (${item.year})`;
  if (item.creators.length > 0) paper += `, by ${item.creators.join(', ')}`;
  paper += '.';
  const lines = [paper];
  if (item.abstract) lines.push(`Abstract: ${item.abstract}`);
  if (paperText !== undefined) {
    lines.push('', 'Paper text (extracted from the PDF):', '"""', paperText, '"""');
  }
  const { priorExchange } = input;
  if (priorExchange) {
    // Continue in Pane into a non-empty Thread (#10): the inline exchange is
    // quoted once as prior context; the Answer goes in verbatim.
    lines.push(
      '',
      'Earlier in this conversation (from the reader):',
      `Question: ${priorExchange.question.trim()}`,
      'Answer:',
      '"""',
      priorExchange.answer,
      '"""',
    );
  }
  const { selection } = input;
  if (selection) {
    const heading =
      selection.pageLabel !== undefined && selection.pageLabel !== ''
        ? `Selection (page ${selection.pageLabel}):`
        : 'Selection:';
    // The Selection's text goes in verbatim: not trimmed, not escaped.
    lines.push('', heading, '"""', selection.text, '"""');
    if (selection.imagePng !== undefined) lines.push(SELECTION_PICTURE_NOTE);
  }
  // A Quick Action's fixed wording replaces any typed text.
  const question =
    input.quickAction !== undefined
      ? QUICK_ACTION_WORDINGS[input.quickAction]
      : input.question.trim();
  lines.push('', `Question: ${question}`);

  const content: ContentBlock[] = [{ type: 'text', text: lines.join('\n') }];
  if (selection?.imagePng !== undefined) {
    content.push({
      type: 'image',
      mediaType: 'image/png',
      data: selection.imagePng,
    });
  }
  return { systemPrompt: parts.join('\n\n'), content, readableFiles };
}

// Context Builder (pure): turns a question into prompt content and a
// readable-file allowlist. Item Context, About me and language land in #4,
// Quick Actions and the Selection in #7, Paper Context modes and the Selection
// picture in #8.
import { notImplemented } from './not-implemented';
import type { BuiltQuestion, QuestionInput, QuickAction } from './types';

export const BASE_SYSTEM_PROMPT =
  'You help a researcher read academic papers inside Zotero. Answer concisely in Markdown. Write math in LaTeX with $...$ for inline and $$...$$ for display.';

export const QUICK_ACTION_WORDINGS: Readonly<Record<QuickAction, string>> = {
  explain: 'Explain this passage in plain language.',
  define: 'Define this term or notation as it is used in this paper. Be brief.',
  'explain-math':
    'Explain the math in this passage. First restate the equation in LaTeX, then explain what each part means and how it follows.',
};

export function buildQuestion(input: QuestionInput): BuiltQuestion {
  if (input.selection?.imagePng !== undefined) {
    throw new Error('buildQuestion: Selection picture lands in #8');
  }
  if (input.priorExchange !== undefined) return notImplemented('buildQuestion priorExchange', '#10');
  if (input.paperContext !== 'none') throw new Error('buildQuestion: Paper Context lands in #8');

  const parts = [BASE_SYSTEM_PROMPT];
  const aboutMe = input.aboutMe.trim();
  if (aboutMe) parts.push(`About the reader: ${aboutMe}`);
  const language = input.answerLanguage.trim();
  parts.push(
    language === '' || language === 'match'
      ? 'Answer in the language of the question.'
      : `Answer in ${language}.`,
  );

  const { item } = input;
  let paper = `Paper: "${item.title || 'Untitled'}"`;
  if (item.year) paper += ` (${item.year})`;
  if (item.creators.length > 0) paper += `, by ${item.creators.join(', ')}`;
  paper += '.';
  const lines = [paper];
  if (item.abstract) lines.push(`Abstract: ${item.abstract}`);
  const { selection } = input;
  if (selection) {
    const heading =
      selection.pageLabel !== undefined && selection.pageLabel !== ''
        ? `Selection (page ${selection.pageLabel}):`
        : 'Selection:';
    // The Selection's text goes in verbatim: not trimmed, not escaped.
    lines.push('', heading, '"""', selection.text, '"""');
  }
  // A Quick Action's fixed wording replaces any typed text.
  const question =
    input.quickAction !== undefined
      ? QUICK_ACTION_WORDINGS[input.quickAction]
      : input.question.trim();
  lines.push('', `Question: ${question}`);

  return {
    systemPrompt: parts.join('\n\n'),
    content: [{ type: 'text', text: lines.join('\n') }],
    readableFiles: [],
  };
}

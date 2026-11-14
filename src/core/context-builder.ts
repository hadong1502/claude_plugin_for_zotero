// Context Builder (pure): turns a question into prompt content and a
// readable-file allowlist. Item Context, About me and language land in #4,
// Quick Actions in #7, Paper Context modes and the Selection picture in #8.
import { notImplemented } from './not-implemented';
import type { BuiltQuestion, QuestionInput } from './types';

export const BASE_SYSTEM_PROMPT =
  'You help a researcher read academic papers inside Zotero. Answer concisely in Markdown. Write math in LaTeX with $...$ for inline and $$...$$ for display.';

export function buildQuestion(input: QuestionInput): BuiltQuestion {
  if (input.quickAction !== undefined) return notImplemented('buildQuestion quickAction', '#7');
  if (input.selection !== undefined) return notImplemented('buildQuestion selection', '#7/#8');
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
  lines.push('', `Question: ${input.question.trim()}`);

  return {
    systemPrompt: parts.join('\n\n'),
    content: [{ type: 'text', text: lines.join('\n') }],
    readableFiles: [],
  };
}

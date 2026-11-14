// Acceptance tests for the Context Builder (#4): Item Context, About me and
// answer language. Paper Context modes land in #8.
import { describe, expect, it } from 'vitest';

import { buildQuestion } from '../../src/core/context-builder';
import type { QuestionInput } from '../../src/core/types';

function input(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    item: { title: 'T', creators: [] },
    question: 'Q?',
    paperContext: 'none',
    aboutMe: '',
    answerLanguage: 'match',
    ...overrides,
  };
}

function textOf(built: ReturnType<typeof buildQuestion>): string {
  const block = built.content[0];
  return block.type === 'text' ? block.text : '';
}

describe('buildQuestion', () => {
  it('system prompt starts with the base prompt', () => {
    const { systemPrompt } = buildQuestion(input());
    expect(
      systemPrompt.startsWith(
        'You help a researcher read academic papers inside Zotero. Answer concisely in Markdown. Write math in LaTeX with $...$ for inline and $$...$$ for display.',
      ),
    ).toBe(true);
  });

  it('about me is included trimmed when set', () => {
    const { systemPrompt } = buildQuestion(input({ aboutMe: '  a PhD student  ' }));
    expect(systemPrompt.split('\n\n')).toContain('About the reader: a PhD student');
  });

  it('about me is omitted when blank', () => {
    const { systemPrompt } = buildQuestion(input({ aboutMe: '   ' }));
    expect(systemPrompt).not.toContain('About the reader: ');
  });

  it('language "match" asks for the question\'s language', () => {
    const { systemPrompt } = buildQuestion(input({ answerLanguage: 'match' }));
    expect(systemPrompt.endsWith('\n\nAnswer in the language of the question.')).toBe(true);
  });

  it('language "French" asks for French', () => {
    const { systemPrompt } = buildQuestion(input({ answerLanguage: 'French' }));
    expect(systemPrompt.endsWith('\n\nAnswer in French.')).toBe(true);
  });

  it('content is one text block with the exact paper line, abstract and question', () => {
    const built = buildQuestion(
      input({
        item: {
          title: 'Attention Is All You Need',
          creators: ['Ashish Vaswani', 'Noam Shazeer'],
          year: '2017',
          abstract: 'We propose…',
        },
        question: ' What is a transformer? ',
      }),
    );
    expect(built.content).toEqual([
      {
        type: 'text',
        text: 'Paper: "Attention Is All You Need" (2017), by Ashish Vaswani, Noam Shazeer.\nAbstract: We propose…\n\nQuestion: What is a transformer?',
      },
    ]);
  });

  it('missing year, creators and abstract produce Paper: "T".', () => {
    const built = buildQuestion(input({ item: { title: 'T', creators: [] } }));
    expect(textOf(built)).toBe('Paper: "T".\n\nQuestion: Q?');
  });

  it('an empty title becomes Untitled', () => {
    const built = buildQuestion(input({ item: { title: '', creators: [] } }));
    expect(textOf(built).split('\n')[0]).toBe('Paper: "Untitled".');
  });

  it('no readable files for paperContext none', () => {
    expect(buildQuestion(input({ paperContext: 'none' })).readableFiles).toEqual([]);
  });
});

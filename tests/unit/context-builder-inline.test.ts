// Acceptance tests for the Context Builder (#7): Quick Action wordings and the
// Selection in the prompt (#1 user stories 17-20, 24, 25). Picture and Paper
// Context modes land in #8.
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

const WORDINGS = {
  explain: 'Explain this passage in plain language.',
  define: 'Define this term or notation as it is used in this paper. Be brief.',
  'explain-math':
    'Explain the math in this passage. First restate the equation in LaTeX, then explain what each part means and how it follows.',
} as const;

describe('buildQuestion with a Quick Action or Selection', () => {
  it('Quick Action wordings are exact: explain', () => {
    const text = textOf(buildQuestion(input({ question: '', quickAction: 'explain' })));
    expect(text.endsWith(`Question: ${WORDINGS.explain}`)).toBe(true);
  });

  it('Quick Action wordings are exact: define', () => {
    const text = textOf(buildQuestion(input({ question: '', quickAction: 'define' })));
    expect(text.endsWith(`Question: ${WORDINGS.define}`)).toBe(true);
  });

  it('Quick Action wordings are exact: explain-math', () => {
    const text = textOf(buildQuestion(input({ question: '', quickAction: 'explain-math' })));
    expect(text.endsWith(`Question: ${WORDINGS['explain-math']}`)).toBe(true);
  });

  it('explain the math asks for LaTeX first', () => {
    const text = textOf(buildQuestion(input({ question: '', quickAction: 'explain-math' })));
    expect(text).toContain('restate the equation in LaTeX');
  });

  it('a Quick Action overrides typed question text', () => {
    const text = textOf(buildQuestion(input({ question: 'ignored', quickAction: 'define' })));
    expect(text).not.toContain('ignored');
  });

  it('a Quick Action without a Selection uses the plain layout with the wording as the question', () => {
    const text = textOf(buildQuestion(input({ question: '', quickAction: 'explain' })));
    expect(text).toBe(`Paper: "T".\n\nQuestion: ${WORDINGS.explain}`);
  });

  it('the Selection is quoted with its page label', () => {
    const text = textOf(
      buildQuestion(
        input({ question: 'What is this?', selection: { text: 'E = mc^2', pageLabel: '5' } }),
      ),
    );
    expect(text).toBe(
      'Paper: "T".\n\nSelection (page 5):\n"""\nE = mc^2\n"""\n\nQuestion: What is this?',
    );
  });

  it('the Selection without a page label', () => {
    const text = textOf(buildQuestion(input({ selection: { text: 'E = mc^2' } })));
    expect(text).toContain('\nSelection:\n"""\n');
  });

  it('Selection text is passed through unchanged', () => {
    const raw = '  two\nlines with "quotes" and $x$  ';
    const text = textOf(buildQuestion(input({ selection: { text: raw, pageLabel: '1' } })));
    expect(text).toContain(`"""\n${raw}\n"""`);
  });

  it('abstract comes before the Selection', () => {
    const text = textOf(
      buildQuestion(
        input({
          item: { title: 'T', creators: [], abstract: 'A.' },
          selection: { text: 'x', pageLabel: '2' },
        }),
      ),
    );
    expect(text.startsWith('Paper: "T".\nAbstract: A.\n\nSelection')).toBe(true);
  });

  it('a Selection picture is rejected until #8', () => {
    expect(() => buildQuestion(input({ selection: { text: 'x', imagePng: 'iVBOR' } }))).toThrow(
      'buildQuestion: Selection picture lands in #8',
    );
  });

  it('system prompt is unchanged by Selection and Quick Action', () => {
    const plain = buildQuestion(input({ question: '' })).systemPrompt;
    const withBoth = buildQuestion(
      input({ question: '', quickAction: 'explain', selection: { text: 'x', pageLabel: '3' } }),
    ).systemPrompt;
    expect(withBoth).toBe(plain);
  });
});

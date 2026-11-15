// Context Builder priorExchange (#10): Continue in Pane quotes the earlier
// exchange as prior context after the Paper block (#1 user stories 21 and 22).
import { describe, expect, it } from 'vitest';

import { buildQuestion } from '../../src/core/context-builder';
import type { QuestionInput } from '../../src/core/types';

function input(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    item: { title: 'T', creators: [] },
    question: 'Q2',
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

const PRIOR = { question: ' Q1 ', answer: 'A1 $x$' };

describe('Context Builder priorExchange', () => {
  it('prior exchange is quoted after the paper block', () => {
    const text = textOf(buildQuestion(input({ priorExchange: PRIOR })));
    expect(text).toBe(
      'Paper: "T".\n\nEarlier in this conversation (from the reader):\nQuestion: Q1\nAnswer:\n"""\nA1 $x$\n"""\n\nQuestion: Q2',
    );
  });

  it('prior exchange comes before the Selection', () => {
    const text = textOf(
      buildQuestion(input({ priorExchange: PRIOR, selection: { text: 'S', pageLabel: '2' } })),
    );
    expect(text.indexOf('Earlier in this conversation')).toBeLessThan(text.indexOf('Selection (page 2):'));
  });

  it('system prompt is unchanged by prior exchange', () => {
    const withPrior = buildQuestion(input({ priorExchange: PRIOR })).systemPrompt;
    expect(withPrior).toBe(buildQuestion(input()).systemPrompt);
  });
});

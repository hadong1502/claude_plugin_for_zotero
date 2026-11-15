// Acceptance tests for the Context Builder (#8): Paper Context modes and the
// Selection picture in the prompt (#1 user stories on Paper Context and the
// Selection picture).
import { describe, expect, it } from 'vitest';

import {
  buildQuestion,
  EXTRACTED_TEXT_LIMIT,
  PAPER_READ_FIRST,
  PAPER_READ_WHEN_NEEDED,
  PAPER_TEXT_INCLUDED,
  SELECTION_PICTURE_NOTE,
} from '../../src/core/context-builder';
import type { QuestionInput } from '../../src/core/types';

const PDF = 'C:\\p\\a.pdf';

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

describe('buildQuestion with Paper Context modes and a Selection picture', () => {
  it('none ignores the PDF', () => {
    const built = buildQuestion(
      input({ paperContext: 'none', pdfPath: PDF, extractedText: 'BODY' }),
    );
    expect(built.readableFiles).toEqual([]);
  });

  it('none leaves the prompt free of the PDF', () => {
    const built = buildQuestion(
      input({ paperContext: 'none', pdfPath: PDF, extractedText: 'BODY' }),
    );
    expect(built.systemPrompt).not.toContain('PDF');
  });

  it('claude-decides makes the PDF the only readable file', () => {
    const built = buildQuestion(input({ paperContext: 'claude-decides', pdfPath: PDF }));
    expect(built.readableFiles).toEqual(['C:\\p\\a.pdf']);
  });

  it('claude-decides tells Claude to read only when needed', () => {
    const built = buildQuestion(input({ paperContext: 'claude-decides', pdfPath: PDF }));
    expect(built.systemPrompt.endsWith(PAPER_READ_WHEN_NEEDED(PDF))).toBe(true);
  });

  it('the read-when-needed sentence is exact', () => {
    expect(PAPER_READ_WHEN_NEEDED('C:\\p\\a.pdf')).toBe(
      "The paper's PDF is at C:\\p\\a.pdf. Read it with the Read tool only if the question needs the paper's content beyond what is given here.",
    );
  });

  it('forced with a PDF tells Claude to read first', () => {
    const built = buildQuestion(input({ paperContext: 'forced', pdfPath: PDF }));
    expect(built.systemPrompt.endsWith(PAPER_READ_FIRST(PDF))).toBe(true);
  });

  it('the read-first sentence is exact', () => {
    expect(PAPER_READ_FIRST('C:\\p\\a.pdf')).toBe(
      "The paper's PDF is at C:\\p\\a.pdf. Read it with the Read tool before answering, and base your Answer on it.",
    );
  });

  it('forced with a PDF makes it the only readable file', () => {
    const built = buildQuestion(input({ paperContext: 'forced', pdfPath: PDF }));
    expect(built.readableFiles).toEqual([PDF]);
  });

  it('forced with extracted text includes the text', () => {
    const built = buildQuestion(input({ paperContext: 'forced', extractedText: 'BODY' }));
    expect(textOf(built)).toContain('Paper text (extracted from the PDF):\n"""\nBODY\n"""');
  });

  it('forced with extracted text has no readable file', () => {
    const built = buildQuestion(input({ paperContext: 'forced', extractedText: 'BODY' }));
    expect(built.readableFiles).toEqual([]);
  });

  it('forced with extracted text says the text is included', () => {
    const built = buildQuestion(input({ paperContext: 'forced', extractedText: 'BODY' }));
    expect(built.systemPrompt.endsWith(PAPER_TEXT_INCLUDED)).toBe(true);
  });

  it('the text-included sentence is exact', () => {
    expect(PAPER_TEXT_INCLUDED).toBe(
      "The paper's full text, extracted from its PDF, is included in the message. Base your Answer on it.",
    );
  });

  it('extracted text wins over the PDF', () => {
    const built = buildQuestion(
      input({ paperContext: 'forced', pdfPath: PDF, extractedText: 'BODY' }),
    );
    expect(built.systemPrompt.endsWith(PAPER_TEXT_INCLUDED)).toBe(true);
  });

  it('extracted text wins over the PDF for readable files', () => {
    const built = buildQuestion(
      input({ paperContext: 'forced', pdfPath: PDF, extractedText: 'BODY' }),
    );
    expect(built.readableFiles).toEqual([]);
  });

  it('long extracted text is truncated', () => {
    const built = buildQuestion(
      input({
        paperContext: 'forced',
        extractedText: 'x'.repeat(EXTRACTED_TEXT_LIMIT + 10),
      }),
    );
    expect(textOf(built)).toContain(
      `"""\n${'x'.repeat(EXTRACTED_TEXT_LIMIT)}\n[\u2026truncated]\n"""`,
    );
  });

  it('paper text comes after the Abstract line', () => {
    const built = buildQuestion(
      input({
        item: { title: 'T', creators: [], abstract: 'ABS' },
        paperContext: 'forced',
        extractedText: 'BODY',
      }),
    );
    expect(textOf(built)).toContain('Abstract: ABS\n\nPaper text (extracted from the PDF):');
  });

  it('paper text comes before the prior exchange', () => {
    const text = textOf(
      buildQuestion(
        input({
          paperContext: 'forced',
          extractedText: 'BODY',
          priorExchange: { question: 'Earlier?', answer: 'Before.' },
        }),
      ),
    );
    expect(text.indexOf('Paper text (extracted')).toBeLessThan(
      text.indexOf('Earlier in this conversation'),
    );
  });

  it('paper text comes before the Selection', () => {
    const text = textOf(
      buildQuestion(
        input({
          paperContext: 'forced',
          extractedText: 'BODY',
          selection: { text: 'SEL' },
        }),
      ),
    );
    expect(text.indexOf('Paper text (extracted')).toBeLessThan(text.indexOf('Selection:'));
  });

  it('a mode without PDF or text behaves as none', () => {
    const forced = buildQuestion(input({ paperContext: 'forced' }));
    expect(forced).toEqual(buildQuestion(input({ paperContext: 'none' })));
  });

  it('claude-decides without a PDF behaves as none', () => {
    const decides = buildQuestion(input({ paperContext: 'claude-decides' }));
    expect(decides).toEqual(buildQuestion(input({ paperContext: 'none' })));
  });

  it('a Selection picture adds an image block', () => {
    const built = buildQuestion(input({ selection: { text: 'SEL', imagePng: 'iVBOR' } }));
    expect(built.content[1]).toEqual({ type: 'image', mediaType: 'image/png', data: 'iVBOR' });
  });

  it('a Selection picture is announced in the text', () => {
    const built = buildQuestion(input({ selection: { text: 'SEL', imagePng: 'iVBOR' } }));
    expect(textOf(built)).toContain(`"""\n${SELECTION_PICTURE_NOTE}`);
  });

  it('the picture note is exact', () => {
    expect(SELECTION_PICTURE_NOTE).toBe('(A picture of the selected region is attached.)');
  });

  it('no picture means one text block', () => {
    const built = buildQuestion(input({ selection: { text: 'SEL' } }));
    expect(built.content).toHaveLength(1);
  });
});

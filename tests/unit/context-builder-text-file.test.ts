// The paper's text file in Paper Context (#11 manual run, amending #8): Claude
// may Read the paper's extracted-text file as well as its PDF. Copy comes from
// the #1 spec's Context Builder section and the #11 decision.
import { describe, expect, it } from 'vitest';

import {
  buildQuestion,
  PAPER_READ_WHEN_NEEDED,
  PAPER_TEXT_FIRST,
  PAPER_TEXT_INCLUDED,
  PAPER_TEXT_WHEN_NEEDED,
} from '../../src/core/context-builder';
import type { QuestionInput } from '../../src/core/types';

const PDF = 'C:\\p\\a.pdf';
const TXT = 'C:\\p\\a.txt';

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

describe('Paper Context prompt copy for the text file', () => {
  it('both files, claude-decides: the sentence is exact', () => {
    expect(PAPER_TEXT_WHEN_NEEDED('C:\\p\\a.txt', 'C:\\p\\a.pdf')).toBe(
      "The paper's text, extracted from its PDF, is at C:\\p\\a.txt, and the PDF itself is at C:\\p\\a.pdf. Read the text file with the Read tool only if the question needs the paper's content beyond what is given here. Read pages of the PDF only when you need to see an equation, figure or table as typeset.",
    );
  });

  it('both files, forced: the sentence is exact', () => {
    expect(PAPER_TEXT_FIRST('C:\\p\\a.txt', 'C:\\p\\a.pdf')).toBe(
      "The paper's text, extracted from its PDF, is at C:\\p\\a.txt, and the PDF itself is at C:\\p\\a.pdf. Read the text file with the Read tool before answering, and base your Answer on it. Read pages of the PDF when you need to see an equation, figure or table as typeset.",
    );
  });

  it('text only, claude-decides: the sentence is exact', () => {
    expect(PAPER_TEXT_WHEN_NEEDED('C:\\p\\a.txt')).toBe(
      "The paper's text, extracted from its PDF, is at C:\\p\\a.txt. Read it with the Read tool only if the question needs the paper's content beyond what is given here.",
    );
  });

  it('text only, forced: the sentence is exact', () => {
    expect(PAPER_TEXT_FIRST('C:\\p\\a.txt')).toBe(
      "The paper's text, extracted from its PDF, is at C:\\p\\a.txt. Read it with the Read tool before answering, and base your Answer on it.",
    );
  });
});

describe('buildQuestion with the paper text file', () => {
  it('both files, claude-decides, ends with the read-when-needed copy for both', () => {
    const built = buildQuestion(input({ paperContext: 'claude-decides', textPath: TXT, pdfPath: PDF }));
    expect(built.systemPrompt.endsWith(PAPER_TEXT_WHEN_NEEDED(TXT, PDF))).toBe(true);
  });

  it('both files, forced, ends with the read-first copy for both', () => {
    const built = buildQuestion(input({ paperContext: 'forced', textPath: TXT, pdfPath: PDF }));
    expect(built.systemPrompt.endsWith(PAPER_TEXT_FIRST(TXT, PDF))).toBe(true);
  });

  it('text only, claude-decides, ends with the read-when-needed copy for the text', () => {
    const built = buildQuestion(input({ paperContext: 'claude-decides', textPath: TXT }));
    expect(built.systemPrompt.endsWith(PAPER_TEXT_WHEN_NEEDED(TXT))).toBe(true);
  });

  it('text only, forced, ends with the read-first copy for the text', () => {
    const built = buildQuestion(input({ paperContext: 'forced', textPath: TXT }));
    expect(built.systemPrompt.endsWith(PAPER_TEXT_FIRST(TXT))).toBe(true);
  });

  it('readable files list the text file first, then the PDF', () => {
    const built = buildQuestion(input({ paperContext: 'claude-decides', pdfPath: PDF, textPath: TXT }));
    expect(built.readableFiles).toEqual(['C:\\p\\a.txt', 'C:\\p\\a.pdf']);
  });

  it('text only makes the text file the only readable file', () => {
    const built = buildQuestion(input({ paperContext: 'forced', textPath: TXT }));
    expect(built.readableFiles).toEqual(['C:\\p\\a.txt']);
  });

  it('an empty text path counts as absent', () => {
    const built = buildQuestion(input({ paperContext: 'claude-decides', pdfPath: PDF, textPath: '' }));
    expect({ files: built.readableFiles, prompt: built.systemPrompt.endsWith(PAPER_READ_WHEN_NEEDED(PDF)) }).toEqual({
      files: ['C:\\p\\a.pdf'],
      prompt: true,
    });
  });

  it('extracted text still wins over both files', () => {
    const built = buildQuestion(
      input({ paperContext: 'forced', pdfPath: PDF, textPath: TXT, extractedText: 'BODY' }),
    );
    expect({ files: built.readableFiles, prompt: built.systemPrompt.endsWith(PAPER_TEXT_INCLUDED) }).toEqual({
      files: [],
      prompt: true,
    });
  });

  it('none ignores the text file', () => {
    const built = buildQuestion(input({ paperContext: 'none', pdfPath: PDF, textPath: TXT }));
    expect({ files: built.readableFiles, mentions: built.systemPrompt.includes('a.txt') }).toEqual({
      files: [],
      mentions: false,
    });
  });
});

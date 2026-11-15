// Paper Context rules (#1, #8): force phrases, mode resolution, readable PDF
// paths and Read rule paths. Windows-path backslashes are written `\\` in TS.
import { describe, expect, it } from 'vitest';

import {
  FORCE_PHRASES,
  canReadPdfPath,
  readRulePath,
  resolvePaperContext,
  wantsFullPaper,
} from '../../src/core/paper-context';

describe('FORCE_PHRASES', () => {
  // Characterization of data: passes against the stub.
  it('force phrases are exactly the spec list', () => {
    expect(FORCE_PHRASES).toEqual(['add context', 'use the paper', 'use full paper', 'read the paper']);
  });
});

describe('wantsFullPaper', () => {
  it.each([
    'Please ADD CONTEXT here',
    'Please USE THE PAPER here',
    'Please Use Full Paper here',
    'Please READ the PAPER here',
  ])('each force phrase forces, in any case: %s', (q) => {
    expect(wantsFullPaper(q)).toBe(true);
  });

  it('extra whitespace inside a phrase still matches', () => {
    expect(wantsFullPaper('use   the\npaper')).toBe(true);
  });

  it.each(['reuse the papers', 'readthe paper'])('phrases match whole words only: %s', (q) => {
    expect(wantsFullPaper(q)).toBe(false);
  });

  it('an ordinary question does not force', () => {
    expect(wantsFullPaper('What is a transformer?')).toBe(false);
  });
});

describe('resolvePaperContext', () => {
  it('no PDF means no Paper Context', () => {
    expect(resolvePaperContext({ useFullPaper: true, question: 'use the paper', hasPdf: false })).toBe('none');
  });

  it('the toggle forces', () => {
    expect(resolvePaperContext({ useFullPaper: true, question: 'hi', hasPdf: true })).toBe('forced');
  });

  it('a phrase forces', () => {
    expect(resolvePaperContext({ useFullPaper: false, question: 'read the paper please', hasPdf: true })).toBe('forced');
  });

  it('default with a PDF is claude-decides', () => {
    expect(resolvePaperContext({ useFullPaper: false, question: 'What is this?', hasPdf: true })).toBe('claude-decides');
  });
});

describe('canReadPdfPath', () => {
  it.each([
    'C:\\Users\\u\\Zotero\\storage\\K\\a [1].pdf',
    'D:\\x\\Smith, Lee (2024) {v2} #1 & co.pdf',
    'c:\\a_b-c.d.pdf',
  ])('verified paths are readable: %s', (p) => {
    expect(canReadPdfPath(p)).toBe(true);
  });

  it.each([
    '\\\\server\\share\\a.pdf',
    'storage\\a.pdf',
    'C:\\Users\\Zo\u00eb\\a.pdf',
    "C:\\a'b.pdf",
    'C:\\a%b.pdf',
    'C:\\a+b.pdf',
  ])('unverified paths are not readable: %s', (p) => {
    expect(canReadPdfPath(p)).toBe(false);
  });
});

describe('readRulePath', () => {
  it('rule path follows the ADR example', () => {
    expect(readRulePath('C:\\Users\\u\\Zotero\\storage\\K\\a [1].pdf')).toBe('//c/Users/u/Zotero/storage/K/a \\[1\\].pdf');
  });

  it('rule path escapes braces and keeps other characters', () => {
    expect(readRulePath('D:\\x\\Smith, Lee (2024) {v2} #1 & co.pdf')).toBe('//d/x/Smith, Lee (2024) \\{v2\\} #1 & co.pdf');
  });

  it('rule path rejects unsupported paths', () => {
    expect(() => readRulePath('\\\\server\\share\\a.pdf')).toThrow('readRulePath: unsupported path');
  });
});

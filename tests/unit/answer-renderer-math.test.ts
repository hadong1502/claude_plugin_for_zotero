// @vitest-environment happy-dom
// KaTeX math in Answers (#1, #6): inline $...$ and display $$...$$ are
// typeset, dollar amounts stay text, half-streamed math stays literal, and
// invalid LaTeX or math inside code never throws or typesets.
import { describe, expect, it } from 'vitest';

import { renderAnswerHtml } from '../../src/core/answer-renderer';

function render(markdown: string): Document {
  return new DOMParser().parseFromString(renderAnswerHtml(markdown), 'text/html');
}

const TEX = 'annotation[encoding="application/x-tex"]';

describe('renderAnswerHtml math', () => {
  it('inline math is typeset', () => {
    const doc = render('Let $\\alpha$ be');
    expect(doc.querySelectorAll('.katex')).toHaveLength(1);
  });

  it('inline math keeps its TeX source in the annotation', () => {
    const doc = render('Let $\\alpha$ be');
    expect(doc.querySelector(TEX)?.textContent).toBe('\\alpha');
  });

  it('display math is typeset in display mode', () => {
    const doc = render('$$x^2$$');
    expect(doc.querySelectorAll('.katex-display')).toHaveLength(1);
  });

  it('display math keeps its TeX source in the annotation', () => {
    const doc = render('$$x^2$$');
    expect(doc.querySelector(`.katex-display ${TEX}`)?.textContent).toBe('x^2');
  });

  it('display math may span lines', () => {
    const doc = render('$$\na = b\n$$');
    expect(doc.querySelectorAll('.katex-display')).toHaveLength(1);
  });

  it('display math spanning lines keeps its TeX source', () => {
    const doc = render('$$\na = b\n$$');
    expect(doc.querySelector(`.katex-display ${TEX}`)?.textContent?.trim()).toBe('a = b');
  });

  it('backslashes inside math are not Markdown escapes', () => {
    const doc = render('$a \\\\ b$');
    expect(doc.querySelector(TEX)?.textContent).toBe('a \\\\ b');
  });

  it('dollar amounts are not math (two prices)', () => {
    const doc = render('It costs $5 and $10.');
    expect(doc.querySelector('.katex')).toBeNull();
  });

  it('dollar amounts stay in the text (two prices)', () => {
    const doc = render('It costs $5 and $10.');
    expect(doc.body.textContent).toContain('$5 and $10');
  });

  it('dollar amounts are not math (range)', () => {
    const doc = render('$5\u2013$10');
    expect(doc.querySelector('.katex')).toBeNull();
  });

  it('an escaped dollar is a literal dollar', () => {
    const doc = render('\\$x$');
    expect(doc.querySelector('.katex')).toBeNull();
  });

  it('an escaped dollar keeps the text', () => {
    const doc = render('\\$x$');
    expect(doc.body.textContent).toContain('$x$');
  });

  it('half-streamed inline math stays literal', () => {
    const doc = render('Let $\\alpha');
    expect(doc.querySelector('.katex')).toBeNull();
  });

  it('half-streamed inline math keeps its text', () => {
    const doc = render('Let $\\alpha');
    expect(doc.body.textContent?.trim().endsWith('$\\alpha')).toBe(true);
  });

  it('half-streamed display math stays literal and does not throw', () => {
    const doc = render('$$\\frac{a}{');
    expect(doc.querySelector('.katex')).toBeNull();
  });

  it('completed math after streaming is typeset', () => {
    const doc = render('$$\\frac{a}{b}$$');
    expect(doc.querySelectorAll('.katex-display')).toHaveLength(1);
  });

  // Characterization of the no-throw contract (#6): these pass before math
  // exists and must keep passing once KaTeX is wired in.
  it.each(['$\\frac{$', '$\\notacommand$', '$$\\def\\a{\\a\\a}\\a$$'])(
    'invalid LaTeX does not throw: %s',
    (input) => {
      expect(() => renderAnswerHtml(input)).not.toThrow();
    },
  );

  it('KaTeX href is not trusted', () => {
    const html = renderAnswerHtml('$\\href{javascript:alert(1)}{x}$');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const hrefs = Array.from(doc.querySelectorAll('[href]')).map((el) => el.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('javascript'))).toBe(false);
  });

  it('math inside inline code is literal', () => {
    const doc = render('`$x$`');
    expect(doc.querySelector('.katex')).toBeNull();
  });

  it('inline code keeps the dollar text', () => {
    const doc = render('`$x$`');
    expect(doc.querySelector('code')?.textContent).toBe('$x$');
  });

  it('math inside a code fence is literal', () => {
    const doc = render('```\n$$y$$\n```');
    expect(doc.querySelector('.katex')).toBeNull();
  });

  it('math sits inside Markdown structure', () => {
    const doc = render('- item $x$');
    expect(doc.querySelector('li .katex')).not.toBeNull();
  });
});

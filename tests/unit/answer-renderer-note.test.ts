// Saving Answers as Zotero notes (#1, #9): question paragraphs, Markdown kept,
// math in Zotero's note format (no KaTeX), turns joined by a rule.
import { describe, expect, it } from 'vitest';

import { toNoteHtml } from '../../src/core/answer-renderer';

function note(answer: string, question = 'Q?'): string {
  return toNoteHtml([{ question, answer }]);
}

describe('toNoteHtml', () => {
  it('a single turn starts with the question paragraph', () => {
    const html = toNoteHtml([{ question: 'What is x?', answer: 'It is **bold**.' }]);
    expect(html.startsWith('<p><strong>Question:</strong> What is x?</p>')).toBe(true);
  });

  it('the Answer keeps its Markdown', () => {
    const html = toNoteHtml([{ question: 'What is x?', answer: 'It is **bold**.' }]);
    expect(html).toContain('<strong>bold</strong>');
  });

  it('question text is escaped', () => {
    const html = note('ok', 'a < b & "c"');
    expect(html).toContain('<p><strong>Question:</strong> a &lt; b &amp; &quot;c&quot;</p>');
  });

  it('question newlines become breaks', () => {
    expect(note('ok', 'line1\nline2')).toContain('line1<br/>line2');
  });

  it("inline math uses Zotero's span format", () => {
    expect(note('Let $\\alpha$ be')).toContain('<span class="math">$\\alpha$</span>');
  });

  it("display math uses Zotero's pre format", () => {
    expect(note('$$x^2$$')).toContain('<pre class="math">$$x^2$$</pre>');
  });

  it("multi-line display math uses Zotero's pre format", () => {
    const html = note('$$\na = b\n$$');
    expect(html).toContain('<pre class="math">$$');
    expect(html).toContain('a = b');
    expect(html).not.toContain('<p>$$');
  });

  it('TeX is HTML-escaped inside math', () => {
    expect(note('$a<b$')).toContain('<span class="math">$a&lt;b$</span>');
  });

  it('no KaTeX markup in notes', () => {
    const outputs = [
      note('Let $\\alpha$ be'),
      note('$$x^2$$'),
      note('$$\na = b\n$$'),
      note('$a<b$'),
    ];
    expect(outputs.join('\n')).not.toContain('katex');
  });

  it('dollar amounts stay text in notes', () => {
    expect(note('It costs $5 and $10.')).not.toContain('class="math"');
  });

  it('turns are joined with a rule', () => {
    const html = toNoteHtml([
      { question: 'First?', answer: 'one' },
      { question: 'Second?', answer: 'two' },
    ]);
    const parts = html.split('<hr/>');
    expect(parts.length === 2 && parts[1].includes('<p><strong>Question:</strong> Second?</p>')).toBe(true);
  });

  it('no rule after the last turn', () => {
    const html = toNoteHtml([
      { question: 'First?', answer: 'one' },
      { question: 'Second?', answer: 'two' },
    ]);
    expect(html.trimEnd().endsWith('<hr/>')).toBe(false);
  });

  it('an empty list gives an empty note', () => {
    expect(toNoteHtml([])).toBe('');
  });

  it('raw HTML in an Answer is escaped', () => {
    expect(note('<script>x</script>')).not.toContain('<script');
  });
});

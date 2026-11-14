// @vitest-environment happy-dom
// Markdown rendering of Answers (#1, #6): block and inline Markdown render,
// raw HTML and unsafe links render inert, and half-streamed text never throws.
import { describe, expect, it } from 'vitest';

import { renderAnswerHtml } from '../../src/core/answer-renderer';

function render(markdown: string): Document {
  return new DOMParser().parseFromString(renderAnswerHtml(markdown), 'text/html');
}

describe('renderAnswerHtml Markdown', () => {
  it('renders a heading', () => {
    expect(render('# Title').querySelector('h1')?.textContent).toBe('Title');
  });

  it('renders a bullet list', () => {
    expect(render('- a\n- b').querySelectorAll('ul > li')).toHaveLength(2);
  });

  it('renders a numbered list', () => {
    expect(render('1. a\n2. b').querySelector('ol')).not.toBeNull();
  });

  it('renders emphasis', () => {
    expect(render('*a* **b**').querySelector('em')?.textContent).toBe('a');
  });

  it('renders strong text', () => {
    expect(render('*a* **b**').querySelector('strong')?.textContent).toBe('b');
  });

  it('renders inline code as text', () => {
    expect(render('`x<y`').querySelector('code')?.textContent).toBe('x<y');
  });

  it('renders fenced code', () => {
    expect(render('```js\nlet a=1;\n```').querySelector('pre > code')?.textContent).toBe('let a=1;\n');
  });

  it('renders table header cells', () => {
    expect(render('| a | b |\n|---|---|\n| 1 | 2 |').querySelectorAll('table th')).toHaveLength(2);
  });

  it('renders table data cells', () => {
    expect(render('| a | b |\n|---|---|\n| 1 | 2 |').querySelectorAll('table td')).toHaveLength(2);
  });

  it('links http URLs', () => {
    expect(render('[site](https://example.org)').querySelector('a')?.getAttribute('href')).toBe(
      'https://example.org',
    );
  });

  it('does not link javascript URLs', () => {
    expect(render('[x](javascript:alert(1))').querySelector('a')).toBeNull();
  });

  it('has no javascript href anywhere for a javascript URL', () => {
    const hrefs = Array.from(render('[x](javascript:alert(1))').querySelectorAll('[href]')).map(
      (el) => el.getAttribute('href') ?? '',
    );
    expect(hrefs.filter((h) => h.includes('javascript'))).toEqual([]);
  });

  it('does not link javascript autolinks', () => {
    expect(render('<javascript:alert(1)>').querySelector('a')).toBeNull();
  });

  it('emits no script element for raw HTML', () => {
    expect(render('<script>alert(1)</script><img src=x onerror=alert(1)>').querySelector('script')).toBeNull();
  });

  it('emits no img element for raw HTML', () => {
    expect(render('<script>alert(1)</script><img src=x onerror=alert(1)>').querySelector('img')).toBeNull();
  });

  it('shows raw HTML as literal text', () => {
    expect(render('<script>alert(1)</script><img src=x onerror=alert(1)>').body.textContent).toContain(
      '<script>',
    );
  });

  it('never emits images', () => {
    expect(render('![alt](https://example.org/a.png)').querySelector('img')).toBeNull();
  });

  it('renders an unfinished code fence as a code block without throwing', () => {
    expect(render('```py\nprint(1)').querySelector('pre > code')?.textContent).toContain('print(1)');
  });

  it('gives empty output for empty input', () => {
    expect(renderAnswerHtml('')).toBe('');
  });
});

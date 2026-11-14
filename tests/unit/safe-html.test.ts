// @vitest-environment happy-dom
// Safe HTML fragments for Answers (#1, #6): renderer output is parsed as HTML
// and stripped of scripts, event handlers, embeds and unsafe links before it
// is inserted into a chrome document.
import { describe, expect, it } from 'vitest';

import { renderAnswerHtml } from '../../src/core/answer-renderer';
import { htmlToFragment } from '../../src/core/safe-html';

function fragmentOf(html: string): DocumentFragment {
  return htmlToFragment(document, html);
}

describe('htmlToFragment', () => {
  it('keeps ordinary markup', () => {
    const first = fragmentOf('<p>a <em>b</em></p>').firstChild as Element;
    expect(first.tagName).toBe('P');
  });

  it('keeps the text of ordinary markup', () => {
    const first = fragmentOf('<p>a <em>b</em></p>').firstChild as Element;
    expect(first.textContent).toBe('a b');
  });

  it('parses as HTML, not XML', () => {
    expect(() => fragmentOf('<p>a<br>b &nbsp;c</p>')).not.toThrow();
  });

  it('keeps a br inside the paragraph when parsing as HTML', () => {
    expect(fragmentOf('<p>a<br>b &nbsp;c</p>').querySelector('p br')).not.toBeNull();
  });

  it('removes script elements', () => {
    expect(fragmentOf('<p>x</p><script>alert(1)</script>').querySelector('script')).toBeNull();
  });

  it('removes event-handler attributes', () => {
    const p = fragmentOf('<p onclick="x()" ONMOUSEOVER="y()">t</p>').querySelector('p') as Element;
    expect(p.attributes.length).toBe(0);
  });

  it('removes unsafe links', () => {
    const anchors = fragmentOf(
      '<a href="javascript:alert(1)">a</a><a href="https://e.org">b</a>',
    ).querySelectorAll('a');
    expect(anchors[0].hasAttribute('href')).toBe(false);
  });

  it('keeps safe links', () => {
    const anchors = fragmentOf(
      '<a href="javascript:alert(1)">a</a><a href="https://e.org">b</a>',
    ).querySelectorAll('a');
    expect(anchors[1].getAttribute('href')).toBe('https://e.org');
  });

  it('removes iframes, objects, embeds and images', () => {
    const fragment = fragmentOf(
      '<iframe src="x"></iframe><object data="x"></object><embed src="x"><img src="x">',
    );
    expect(fragment.querySelectorAll('iframe, object, embed, img').length).toBe(0);
  });

  it('removes svg event handlers', () => {
    const svg = fragmentOf('<svg onload="x()"><foreignObject><p>a</p></foreignObject></svg>')
      .querySelector('svg') as Element;
    expect(svg.hasAttribute('onload')).toBe(false);
  });

  it('removes foreignObject', () => {
    const fragment = fragmentOf('<svg onload="x()"><foreignObject><p>a</p></foreignObject></svg>');
    expect(fragment.querySelector('foreignObject')).toBeNull();
  });

  it('removes style attributes that load URLs', () => {
    const span = fragmentOf('<span style="background:url(http://x)">a</span>')
      .querySelector('span') as Element;
    expect(span.hasAttribute('style')).toBe(false);
  });

  it('keeps harmless style attributes', () => {
    const span = fragmentOf('<span style="height:1em">b</span>').querySelector('span') as Element;
    expect(span.getAttribute('style')).toBe('height:1em');
  });

  it('KaTeX output survives intact', () => {
    const fragment = fragmentOf(renderAnswerHtml('$\alpha$'));
    expect(fragment.querySelectorAll('.katex').length).toBe(1);
  });

  it('keeps the KaTeX annotation text', () => {
    const fragment = fragmentOf(renderAnswerHtml('$\alpha$'));
    expect(fragment.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toBe(
      '\alpha',
    );
  });

  describe('hostile Markdown end to end', () => {
    const hostile = '<script>x</script> [a](javascript:x) $\href{javascript:x}{y}$';

    it('has no script', () => {
      expect(fragmentOf(renderAnswerHtml(hostile)).querySelector('script')).toBeNull();
    });

    it('has no attribute starting with on', () => {
      const all = Array.from(fragmentOf(renderAnswerHtml(hostile)).querySelectorAll('*'));
      const onAttrs = all.flatMap((el) =>
        Array.from(el.attributes).filter((a) => a.name.toLowerCase().startsWith('on')),
      );
      expect(onAttrs.length).toBe(0);
    });

    it('has no href containing javascript', () => {
      const hrefs = Array.from(fragmentOf(renderAnswerHtml(hostile)).querySelectorAll('[href]'))
        .map((el) => el.getAttribute('href') ?? '')
        .filter((h) => /javascript/i.test(h));
      expect(hrefs).toEqual([]);
    });
  });
});

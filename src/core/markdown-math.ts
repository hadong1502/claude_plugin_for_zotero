import katex from 'katex';
import type MarkdownIt from 'markdown-it';

// Math plugin for Answers (#1, #6): inline $...$ and display $$...$$.
const DOLLAR = 0x24;

function isSpace(ch: number): boolean {
  return ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d || ch === 0x0c || ch === 0x0b;
}

/** Index of the closing `$` for inline math opened before `start`, or -1. */
function findInlineClose(src: string, start: number, max: number): number {
  let pos = start;
  while (pos < max) {
    const ch = src.charCodeAt(pos);
    if (ch === 0x0a) return -1;
    if (ch === DOLLAR) {
      const before = src.charCodeAt(pos - 1);
      const after = pos + 1 < max ? src.charCodeAt(pos + 1) : NaN;
      const afterIsDigit = after >= 0x30 && after <= 0x39;
      if (pos > start && !isSpace(before) && !afterIsDigit) return pos;
    }
    pos++;
  }
  return -1;
}

export function markdownMath(md: MarkdownIt): void {
  md.inline.ruler.before('escape', 'math', (state, silent) => {
    const src = state.src;
    const start = state.pos;
    if (src.charCodeAt(start) !== DOLLAR) return false;
    const max = state.posMax;

    let display = false;
    let contentStart: number;
    let contentEnd: number;
    let end: number;
    if (src.charCodeAt(start + 1) === DOLLAR) {
      display = true;
      contentStart = start + 2;
      const close = src.indexOf('$$', contentStart);
      if (close === -1 || close + 2 > max) return false;
      contentEnd = close;
      end = close + 2;
      if (src.slice(contentStart, contentEnd).trim() === '') return false;
    } else {
      contentStart = start + 1;
      if (contentStart >= max || isSpace(src.charCodeAt(contentStart))) return false;
      const close = findInlineClose(src, contentStart, max);
      if (close === -1) return false;
      contentEnd = close;
      end = close + 1;
    }

    if (!silent) {
      const token = state.push(display ? 'math_display' : 'math_inline', 'math', 0);
      token.content = src.slice(contentStart, contentEnd);
      token.markup = display ? '$$' : '$';
    }
    state.pos = end;
    return true;
  });

  const render = (displayMode: boolean) => (tokens: { content: string }[], idx: number): string => {
    const tex = tokens[idx].content;
    try {
      return katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        trust: false,
        strict: 'ignore',
        output: 'htmlAndMathml',
      });
    } catch {
      return `<code class="math-error">${md.utils.escapeHtml(tex)}</code>`;
    }
  };
  md.renderer.rules.math_inline = render(false);
  md.renderer.rules.math_display = render(true);
}

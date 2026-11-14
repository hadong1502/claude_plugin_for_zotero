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
  // Block rule: a line starting with $$ opens display math that runs to the
  // first later line containing $$, so Markdown block markers (blank lines,
  // "- ", "> ", "#") inside the formula do not split it. Text after the
  // closing $$ on the closing line is dropped. Without a closing line the rule
  // does not match and the paragraph/inline path keeps the text literal.
  md.block.ruler.before(
    'paragraph',
    'math_block',
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const src = state.src;
      const first = state.bMarks[startLine] + state.tShift[startLine];
      if (src.slice(first, first + 2) !== '$$') return false;
      const rest = src.slice(first + 2, state.eMarks[startLine]);
      const parts: string[] = [];
      let closeLine = -1;
      const sameLine = rest.indexOf('$$');
      if (sameLine !== -1) {
        parts.push(rest.slice(0, sameLine));
        closeLine = startLine;
      } else {
        parts.push(rest);
        for (let line = startLine + 1; line < endLine; line++) {
          const pos = state.bMarks[line] + state.tShift[line];
          const text = src.slice(pos, state.eMarks[line]);
          if (text.trim() !== '' && state.sCount[line] < state.blkIndent) break;
          const idx = text.indexOf('$$');
          if (idx !== -1) {
            parts.push(text.slice(0, idx));
            closeLine = line;
            break;
          }
          parts.push(text);
        }
      }
      if (closeLine === -1) return false;
      const content = parts.join('\n');
      if (content.trim() === '') return false;
      if (silent) return true;
      const token = state.push('math_block', 'math', 0);
      token.block = true;
      token.content = content;
      token.markup = '$$';
      token.map = [startLine, closeLine + 1];
      state.line = closeLine + 1;
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

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
      if (close === -1 || close + 2 > max || src.slice(contentStart, close).trim() === '') {
        // No usable closer (e.g. half-streamed): both dollars are literal text,
        // so the second one never opens inline math.
        if (!silent) state.pending += '$$';
        state.pos = start + 2;
        return true;
      }
      contentEnd = close;
      end = close + 2;
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
  const renderBlock = render(true);
  md.renderer.rules.math_block = (tokens, idx) => renderBlock(tokens, idx) + '\n';
}

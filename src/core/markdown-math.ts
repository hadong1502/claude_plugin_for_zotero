import katex from 'katex';
import type MarkdownIt from 'markdown-it';

// Math plugin for Answers (#1, #6): inline $...$ and display $$...$$. The
// delimiter rules are shared; the renderer is KaTeX for display (#6) or
// Zotero's note math markup for Saved Notes (#9).
const DOLLAR = 0x24;

/**
 * Turns one formula's TeX into HTML. `displayMode` is true for `$$...$$`;
 * `escapeHtml` is markdown-it's escaper, for renderers that emit the TeX as text.
 */
export type MathRenderer = (
  tex: string,
  displayMode: boolean,
  escapeHtml: (text: string) => string,
) => string;

export interface MarkdownMathOptions {
  /** How formulas become HTML; KaTeX typesetting (katexMath) by default. */
  render?: MathRenderer;
}

/** Typesets a formula with KaTeX; a formula KaTeX cannot handle stays as code. */
export const katexMath: MathRenderer = (tex, displayMode, escapeHtml) => {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: 'ignore',
      output: 'htmlAndMathml',
    });
  } catch {
    return `<code class="math-error">${escapeHtml(tex)}</code>`;
  }
};

/**
 * Zotero's note math format (#9), which its note editor renders: inline
 * `<span class="math">$...$</span>` and display `<pre class="math">$$...$$</pre>`.
 */
export const zoteroNoteMath: MathRenderer = (tex, displayMode, escapeHtml) =>
  displayMode
    ? `<pre class="math">$$${escapeHtml(tex)}$$</pre>`
    : `<span class="math">$${escapeHtml(tex)}$</span>`;

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
      // A `$$` pair is a display delimiter, never an inline closer: skip it.
      if (after === DOLLAR) {
        pos += 2;
        continue;
      }
      if (pos > start && !isSpace(before) && !afterIsDigit) return pos;
    }
    pos++;
  }
  return -1;
}

export function markdownMath(md: MarkdownIt, options: MarkdownMathOptions = {}): void {
  // Block rule: a line starting with $$ opens display math that runs to the
  // first later line containing $$, so Markdown block markers (blank lines,
  // "- ", "> ", "#") inside the formula do not split it. Text after the
  // closing $$ on a multi-line block becomes a following paragraph; with text
  // after a same-line $$...$$ the rule does not match and the inline path
  // handles the line. Without a closing line the rule does not match and the
  // paragraph/inline path keeps the text literal.
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
      let trailing = '';
      if (sameLine !== -1) {
        if (rest.slice(sameLine + 2).trim() !== '') return false;
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
            trailing = text.slice(idx + 2).trim();
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
      if (trailing !== '') {
        state.push('paragraph_open', 'p', 1).map = [closeLine, closeLine + 1];
        const inline = state.push('inline', '', 0);
        inline.content = trailing;
        inline.map = [closeLine, closeLine + 1];
        inline.children = [];
        state.push('paragraph_close', 'p', -1);
      }
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

  const render = options.render ?? katexMath;
  const escapeHtml = md.utils.escapeHtml;
  md.renderer.rules.math_inline = (tokens, idx) => render(tokens[idx].content, false, escapeHtml);
  md.renderer.rules.math_display = (tokens, idx) => render(tokens[idx].content, true, escapeHtml);
  md.renderer.rules.math_block = (tokens, idx) =>
    render(tokens[idx].content, true, escapeHtml) + '\n';
}

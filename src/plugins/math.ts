import katex from 'katex';
import type MarkdownIt from 'markdown-it';
import 'katex/dist/katex.min.css';

/**
 * Self-contained KaTeX math plugin for markdown-it.
 *
 * Inline:  $E=mc^2$
 * Block:   $$
 *          \int_0^1 x^2 dx
 *          $$
 *
 * This avoids the markdown-it-texmath double-rendering issue where both the
 * KaTeX HTML output and a MathML fallback are visible without proper CSS.
 * KaTeX CSS is imported directly so the rendered output is always styled.
 */

// Match inline $...$ — content must not contain $, newline, or be empty.
// Negative lookahead prevents $$ (block delimiter) from matching inline.
const INLINE_MATH_RE = /^\$([^$\n]+?)\$/;

// Heuristic: avoid treating currency like $5 or $10 as math.
// If the content is purely numeric (possibly with decimal/comma), skip.
function looksLikeCurrency(content: string): boolean {
  return /^[\d.,]+$/.test(content.trim());
}

export function useMath(md: MarkdownIt): void {
  // ---- Block math: $$ ... $$ ----
  md.block.ruler.before('fence', 'math_block', (state, start, _end, silent) => {
    const firstLine = state.src.slice(state.bMarks[start], state.eMarks[start]);
    if (!firstLine.startsWith('$$')) return false;

    // Single-line block: $$ ... $$
    const singleLine = firstLine.match(/^\$\$(.+?)\$\$\s*$/);
    if (singleLine) {
      if (silent) return true;
      const token = state.push('math_block', 'div', 0);
      token.content = singleLine[1]!.trim();
      token.markup = '$$';
      state.line = start + 1;
      return true;
    }

    // Multi-line: find closing $$
    let nextLine = start + 1;
    let found = false;
    while (nextLine < state.lineMax) {
      const l = state.src.slice(state.bMarks[nextLine], state.eMarks[nextLine]);
      if (l.trimEnd().endsWith('$$')) {
        found = true;
        break;
      }
      nextLine++;
    }
    if (!found) return false;
    if (silent) return true;

    const content = state.src
      .slice(state.bMarks[start] + 2, state.eMarks[nextLine] - 2)
      .trim();

    const token = state.push('math_block', 'div', 0);
    token.content = content;
    token.markup = '$$';
    state.line = nextLine + 1;
    return true;
  });

  md.renderer.rules.math_block = (tokens, idx): string => {
    const content = tokens[idx]?.content ?? '';
    try {
      const html = katex.renderToString(content, {
        displayMode: true,
        throwOnError: false,
        strict: false
      });
      return `<div class="md-editor-math-block">${html}</div>`;
    } catch {
      return `<div class="md-editor-math-block md-editor-math-error">${escapeHtml(content)}</div>`;
    }
  };

  // ---- Inline math: $ ... $ ----
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    if (state.src[state.pos] !== '$') return false;
    // $$ is block math, not inline
    if (state.src[state.pos + 1] === '$') return false;

    const match = state.src.slice(state.pos).match(INLINE_MATH_RE);
    if (!match) return false;

    const content = match[1] ?? '';
    if (looksLikeCurrency(content)) return false;

    if (silent) return true;

    const token = state.push('math_inline', 'span', 0);
    token.content = content;
    token.markup = '$';
    state.pos += match[0].length;
    return true;
  });

  md.renderer.rules.math_inline = (tokens, idx): string => {
    const content = tokens[idx]?.content ?? '';
    try {
      return katex.renderToString(content, {
        displayMode: false,
        throwOnError: false,
        strict: false
      });
    } catch {
      return `<span class="md-editor-math-error">$${escapeHtml(content)}$</span>`;
    }
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

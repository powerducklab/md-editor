import { describe, expect, it } from 'vitest';
import { Renderer } from '../src/Renderer.js';

describe('math plugin - inline', () => {
  const r = new Renderer({ mindmap: false, codeHighlight: false, tips: false });

  it('renders inline $E=mc^2$ as KaTeX span', () => {
    const html = r.render('The formula $E=mc^2$ is famous.');
    expect(html).toContain('katex');
    // The raw text should NOT appear alongside the rendered math
    expect(html).not.toContain('E=mc2');
  });

  it('renders multiple inline math expressions', () => {
    const html = r.render('$a$ and $b$');
    expect(html.match(/katex/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('does not treat $5 as math (currency)', () => {
    const html = r.render('It costs $5 each.');
    expect(html).not.toContain('katex');
    expect(html).toContain('$5');
  });

  it('does not treat $10.50 as math (currency with decimal)', () => {
    const html = r.render('Price: $10.50');
    expect(html).not.toContain('katex');
  });

  it('renders math with special characters', () => {
    const html = r.render('$\\alpha + \\beta = \\gamma$');
    expect(html).toContain('katex');
  });

  it('handles invalid LaTeX gracefully (no throw)', () => {
    const html = r.render('$\\invalid{cmd}$');
    // Should not throw; either renders with error class or falls back
    expect(html).toBeTruthy();
  });

  it('does not match $$ as inline (block delimiter)', () => {
    const html = r.render('$$x$$');
    // Should be block math, not inline
    expect(html).toContain('md-editor-math-block');
  });
});

describe('math plugin - block', () => {
  const r = new Renderer({ mindmap: false, codeHighlight: false, tips: false });

  it('renders single-line block math $$x$$', () => {
    const html = r.render('$$x = 1$$');
    expect(html).toContain('md-editor-math-block');
    expect(html).toContain('katex');
  });

  it('renders multi-line block math', () => {
    const html = r.render('$$\n\\int_0^1 x^2 dx\n$$');
    expect(html).toContain('md-editor-math-block');
    expect(html).toContain('katex');
  });

  it('renders block math with displayMode', () => {
    const html = r.render('$$E=mc^2$$');
    // KaTeX display mode uses a different class structure
    expect(html).toContain('katex-display');
  });

  it('does not render unclosed block math', () => {
    const html = r.render('$$\nunclosed\n');
    expect(html).not.toContain('md-editor-math-block');
  });
});

describe('math plugin - disabled', () => {
  it('does not render math when math option is false', () => {
    const r = new Renderer({ math: false, mindmap: false, codeHighlight: false, tips: false });
    const html = r.render('$E=mc^2$');
    expect(html).not.toContain('katex');
    expect(html).toContain('$E=mc^2$');
  });
});

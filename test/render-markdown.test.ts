import { describe, expect, it } from 'vitest';
import { renderMarkdown, Renderer } from '../src/Renderer.js';

describe('renderMarkdown - standalone API', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Hello\n\nWorld');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
    expect(html).toContain('World');
  });

  it('renders math by default', () => {
    const html = renderMarkdown('$E=mc^2$');
    expect(html).toContain('katex');
  });

  it('renders code blocks by default', () => {
    const html = renderMarkdown('```js\nconst x = 1;\n```');
    expect(html).toContain('md-editor-codeblock');
  });

  it('renders tips by default', () => {
    const html = renderMarkdown(':::notice\n\nContent.\n\n:::');
    expect(html).toContain('md-editor-tip');
  });

  it('can disable math', () => {
    const html = renderMarkdown('$E=mc^2$', { math: false });
    expect(html).not.toContain('katex');
  });

  it('can disable code highlight', () => {
    const html = renderMarkdown('```js\nconst x = 1;\n```', { codeHighlight: false });
    expect(html).not.toContain('md-editor-codeblock');
  });

  it('can disable tips', () => {
    const html = renderMarkdown(':::notice\n\nContent.\n\n:::', { tips: false });
    expect(html).not.toContain('md-editor-tip');
  });

  it('handles empty string', () => {
    const html = renderMarkdown('');
    expect(typeof html).toBe('string');
  });

  it('handles undefined input gracefully', () => {
    // @ts-expect-error testing undefined input
    const html = renderMarkdown(undefined);
    expect(typeof html).toBe('string');
  });

  it('renders links with target', () => {
    const html = renderMarkdown('[Link](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });

  it('does not allow raw HTML by default', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('allows raw HTML when html option is true', () => {
    const html = renderMarkdown('<div class="custom">text</div>', { html: true });
    expect(html).toContain('<div class="custom">');
  });
});

describe('Renderer class', () => {
  it('creates a renderer with options', () => {
    const r = new Renderer({ math: false, mindmap: false });
    expect(r).toBeInstanceOf(Renderer);
    expect(r.md).toBeTruthy();
  });

  it('render method works', () => {
    const r = new Renderer({ math: false, mindmap: false, codeHighlight: false, tips: false });
    const html = r.render('# Test');
    expect(html).toContain('<h1');
  });
});

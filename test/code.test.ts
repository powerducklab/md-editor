import { describe, expect, it } from 'vitest';
import { Renderer } from '../src/Renderer.js';

describe('code highlighting - basic structure', () => {
  it('wraps code fences in md-editor-codeblock container', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```javascript\nconst x = 1;\n```');
    expect(html).toContain('md-editor-codeblock');
    expect(html).toContain('md-editor-codeblock-header');
    expect(html).toContain('md-editor-codeblock-pre');
  });

  it('renders traffic light dots', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```js\nconst x = 1;\n```');
    expect(html).toContain('md-editor-codeblock-dot--red');
    expect(html).toContain('md-editor-codeblock-dot--yellow');
    expect(html).toContain('md-editor-codeblock-dot--green');
  });

  it('renders a copy button', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```js\nconst x = 1;\n```');
    expect(html).toContain('md-editor-codeblock-copy');
    expect(html).toContain('Copy');
  });

  it('shows the language label', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```python\nprint("hi")\n```');
    expect(html).toContain('md-editor-codeblock-lang');
    expect(html).toContain('python');
  });
});

describe('code highlighting - syntax', () => {
  it('highlights javascript with hljs spans', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```javascript\nconst x = 1;\n```');
    // hljs wraps keywords like const in spans
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('hljs-number');
  });

  it('highlights typescript', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```typescript\nconst x: number = 1;\n```');
    expect(html).toContain('hljs-keyword');
  });

  it('highlights python', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```python\ndef foo():\n    return 42\n```');
    expect(html).toContain('hljs-keyword');
  });

  it('highlights json', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```json\n{"key": "value"}\n```');
    expect(html).toContain('hljs-attr');
  });

  it('highlights bash', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```bash\necho "hello"\n```');
    expect(html).toContain('hljs');
  });

  it('auto-detects language when none is specified', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```\nconst x = 1;\n```');
    // Auto-detection should identify something and add hljs classes
    expect(html).toContain('hljs');
    expect(html).toContain('md-editor-codeblock-lang');
  });

  it('falls back to escaped text for unknown languages', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```totallyunknownlang\nif x > 0 && y < 10\n```');
    // HTML special chars must be escaped, not rendered as live HTML
    expect(html).toContain('&gt;');
    expect(html).toContain('&amp;&amp;');
    expect(html).toContain('&lt;');
  });

  it('does not break on empty code block', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```javascript\n```');
    expect(html).toContain('md-editor-codeblock');
  });
});

describe('code highlighting - mindmap delegation', () => {
  it('delegates mindmap fences to the mindmap plugin', () => {
    const r = new Renderer({ math: false, mindmap: true });
    const html = r.render('```mindmap\n# Root\n- Child\n```');
    expect(html).toContain('md-editor-mindmap');
    expect(html).not.toContain('md-editor-codeblock');
  });

  it('does not wrap mindmap fences when mindmap disabled', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```mindmap\n# Root\n```');
    // When mindmap is disabled, the fence falls through to code highlighting
    expect(html).toContain('md-editor-codeblock');
  });
});

describe('code highlighting - disabled', () => {
  it('does not wrap code blocks when codeHighlight is false', () => {
    const r = new Renderer({ math: false, mindmap: false, codeHighlight: false });
    const html = r.render('```javascript\nconst x = 1;\n```');
    expect(html).not.toContain('md-editor-codeblock');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
  });
});

describe('code highlighting - inline code', () => {
  it('does not wrap inline code in codeblock container', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('Use `const x = 1` here.');
    expect(html).not.toContain('md-editor-codeblock');
    expect(html).toContain('<code>');
  });
});

describe('code highlighting - special characters', () => {
  it('escapes HTML in code content', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```html\n<div class="test">&amp;\n```');
    // The code content should be escaped, not rendered as live HTML.
    // hljs may insert spans between tokens, so check for escaped entities.
    expect(html).toContain('&lt;');
    expect(html).toContain('&quot;');
    expect(html).toContain('hljs-name');
    // The literal source text <div should not appear unescaped in the code area
    const codeArea = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1] ?? '';
    expect(codeArea).not.toContain('<div');
  });

  it('handles code with backticks inside', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```\nconst s = `template ${x}`;\n```');
    expect(html).toContain('md-editor-codeblock');
  });
});

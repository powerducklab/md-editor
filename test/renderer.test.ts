import { describe, expect, it } from 'vitest';
import { Renderer } from '../src/Renderer.js';

describe('Renderer', () => {
  it('renders basic markdown', () => {
    const r = new Renderer();
    const html = r.render('# Hello\n\nWorld');
    expect(html).toContain('<h1>');
    expect(html).toContain('Hello');
    expect(html).toContain('<p>World</p>');
  });

  it('renders empty string safely', () => {
    const r = new Renderer();
    expect(r.render('')).toBe('');
  });

  it('renders null/undefined as empty', () => {
    const r = new Renderer();
    // @ts-expect-error testing runtime safety
    expect(r.render(null)).toBe('');
    // @ts-expect-error testing runtime safety
    expect(r.render(undefined)).toBe('');
  });

  it('renders inline math with KaTeX', () => {
    const r = new Renderer({ math: true });
    const html = r.render('The formula $E=mc^2$ is famous.');
    expect(html).toContain('katex');
    expect(html).toContain('E=mc^2');
  });

  it('renders block math with KaTeX', () => {
    const r = new Renderer({ math: true });
    const html = r.render('$$\\int_0^1 x^2 dx$$');
    expect(html).toContain('katex-display');
  });

  it('disables math when math: false', () => {
    const r = new Renderer({ math: false });
    const html = r.render('$E=mc^2$');
    // Without math plugin, $ is treated as literal text
    expect(html).not.toContain('katex');
  });

  it('renders mindmap fence as placeholder div', () => {
    const r = new Renderer({ mindmap: true });
    const html = r.render('```mindmap\n# Root\n## Branch\n```');
    expect(html).toContain('md-editor-mindmap');
    expect(html).toContain('data-source=');
    expect(html).toContain('Root');
  });

  it('disables mindmap when mindmap: false', () => {
    const r = new Renderer({ mindmap: false });
    const html = r.render('```mindmap\n# Root\n```');
    // Without mindmap plugin, the fence is rendered as a normal code block
    expect(html).toContain('<code');
    expect(html).not.toContain('md-editor-mindmap');
  });

  it('encodes mindmap source for safe data attribute', () => {
    const r = new Renderer({ mindmap: true });
    const html = r.render('```mindmap\n# Root & <tag>\n```');
    expect(html).toContain('data-source=');
    // The encoded content should not contain raw < or >
    const match = html.match(/data-source="([^"]*)"/);
    expect(match).toBeTruthy();
    expect(match![1]).not.toContain('<');
    expect(match![1]).not.toContain('>');
  });

  it('renders normal code fences unchanged when mindmap is enabled', () => {
    const r = new Renderer({ mindmap: true });
    const html = r.render('```javascript\nconst x = 1;\n```');
    expect(html).toContain('language-javascript');
    expect(html).not.toContain('md-editor-mindmap');
  });

  it('preserves nested code fences inside mindmap', () => {
    const r = new Renderer({ mindmap: true });
    const source = [
      '```mindmap',
      '# Root',
      '## Code example',
      '```js',
      'const x = 1;',
      '```',
      '## Branch two',
      '- Child',
      '```',
    ].join('\n');
    const html = r.render(source);
    expect(html).toContain('md-editor-mindmap');
    // The nested code content should be preserved in the data-source
    const match = html.match(/data-source="([^"]*)"/);
    expect(match).toBeTruthy();
    const decoded = decodeURIComponent(match![1]);
    expect(decoded).toContain('const x = 1;');
    expect(decoded).toContain('Branch two');
    expect(decoded).toContain('Child');
  });

  it('handles deeply nested fences in mindmap', () => {
    const r = new Renderer({ mindmap: true });
    const source = [
      '```mindmap',
      '# Root',
      '## Level 1',
      '```python',
      'def foo():',
      '    pass',
      '```',
      '### Level 2',
      '```bash',
      'echo hi',
      '```',
      '## End',
      '```',
    ].join('\n');
    const html = r.render(source);
    expect(html).toContain('md-editor-mindmap');
    const match = html.match(/data-source="([^"]*)"/);
    const decoded = decodeURIComponent(match![1]);
    expect(decoded).toContain('def foo()');
    expect(decoded).toContain('echo hi');
    expect(decoded).toContain('End');
  });

  it('handles mindmap with no nested content', () => {
    const r = new Renderer({ mindmap: true });
    const html = r.render('```mindmap\n# Only root\n```');
    expect(html).toContain('md-editor-mindmap');
    const match = html.match(/data-source="([^"]*)"/);
    const decoded = decodeURIComponent(match![1]);
    expect(decoded).toContain('Only root');
  });

  it('does not allow raw HTML by default', () => {
    const r = new Renderer();
    const html = r.render('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('allows raw HTML when html: true', () => {
    const r = new Renderer({ html: true });
    const html = r.render('<div>raw</div>');
    expect(html).toContain('<div>raw</div>');
  });

  it('converts soft breaks to <br> when breaks: true', () => {
    const r = new Renderer({ breaks: true });
    const html = r.render('line one\nline two');
    expect(html).toContain('<br');
  });

  it('does not convert soft breaks by default', () => {
    const r = new Renderer();
    const html = r.render('line one\nline two');
    expect(html).not.toContain('<br');
  });

  it('linkifies URLs', () => {
    const r = new Renderer();
    const html = r.render('Visit https://example.com today');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('hydrate is a no-op when mindmap is disabled', async () => {
    const r = new Renderer({ mindmap: false });
    const container = document.createElement('div');
    container.innerHTML = '<div class="md-editor-mindmap"></div>';
    await r.hydrate(container);
    // Should not throw; mindmap nodes remain unhydrated
    expect(container.querySelector('.md-editor-mindmap')).toBeTruthy();
  });

  it('exposes the underlying markdown-it instance', () => {
    const r = new Renderer();
    expect(r.md).toBeDefined();
    expect(typeof r.md.render).toBe('function');
  });
});

describe('Renderer - video rendering', () => {
  it('renders .mp4 image links as <video> elements', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('![clip](https://example.com/clip.mp4)');
    expect(html).toContain('<video');
    expect(html).toContain('controls');
    expect(html).toContain('https://example.com/clip.mp4');
    expect(html).toContain('md-editor-video');
  });

  it('renders .webm as <video>', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('![clip](https://example.com/clip.webm)');
    expect(html).toContain('<video');
  });

  it('renders .ogg as <video>', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('![clip](https://example.com/clip.ogg)');
    expect(html).toContain('<video');
  });

  it('renders regular images as <img>', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('![pic](https://example.com/pic.png)');
    expect(html).toContain('<img');
    expect(html).not.toContain('<video');
  });

  it('renders YouTube thumbnail as linked image (not video)', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render(
      '[![YT](https://img.youtube.com/vi/abc/hqdefault.jpg)](https://www.youtube.com/watch?v=abc)'
    );
    expect(html).toContain('<a href="https://www.youtube.com/watch?v=abc"');
    expect(html).toContain('<img');
    expect(html).not.toContain('<video');
  });

  it('video element includes alt text as title', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('![My video](https://example.com/v.mp4)');
    expect(html).toContain('title="My video"');
  });
});

describe('Renderer - code highlighting integration', () => {
  it('renders code blocks with traffic light UI by default', () => {
    const r = new Renderer({ math: false, mindmap: false });
    const html = r.render('```js\nconst x = 1;\n```');
    expect(html).toContain('md-editor-codeblock');
    expect(html).toContain('md-editor-codeblock-copy');
  });

  it('can disable code highlighting', () => {
    const r = new Renderer({ math: false, mindmap: false, codeHighlight: false });
    const html = r.render('```js\nconst x = 1;\n```');
    expect(html).not.toContain('md-editor-codeblock');
  });
});

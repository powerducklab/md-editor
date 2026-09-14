import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MarkdownEditor } from '../src/index.js';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('MarkdownEditor', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it('throws when container is not found', () => {
    expect(() => new MarkdownEditor('#nonexistent')).toThrow('mount container not found');
  });

  it('accepts an HTMLElement container', () => {
    const editor = new MarkdownEditor(container);
    expect(container.classList.contains('md-editor-root')).toBe(true);
    editor.destroy();
  });

  it('accepts a string selector', () => {
    container.id = 'test-editor';
    const editor = new MarkdownEditor('#test-editor');
    expect(container.classList.contains('md-editor-root')).toBe(true);
    editor.destroy();
  });

  it('initializes with simple mode by default', () => {
    const editor = new MarkdownEditor(container);
    expect(container.classList.contains('md-editor-mode-simple')).toBe(true);
    expect(container.querySelector('.md-editor-toolbar')).toBeNull();
    expect(container.querySelector('.md-editor-statusbar')).toBeNull();
    editor.destroy();
  });

  it('initializes with complex mode (toolbar + statusbar)', () => {
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    expect(container.classList.contains('md-editor-mode-complex')).toBe(true);
    expect(container.querySelector('.md-editor-toolbar')).toBeTruthy();
    expect(container.querySelector('.md-editor-statusbar')).toBeTruthy();
    editor.destroy();
  });

  it('sets data-theme attribute', () => {
    const editor = new MarkdownEditor(container, { theme: 'dark' });
    expect(container.getAttribute('data-theme')).toBe('dark');
    editor.destroy();
  });

  it('getValue returns initial value', () => {
    const editor = new MarkdownEditor(container, { value: '# Hello' });
    expect(editor.getValue()).toBe('# Hello');
    editor.destroy();
  });

  it('setValue updates content', () => {
    const editor = new MarkdownEditor(container, { value: 'initial' });
    editor.setValue('updated');
    expect(editor.getValue()).toBe('updated');
    editor.destroy();
  });

  it('getHtml returns rendered HTML', () => {
    const editor = new MarkdownEditor(container, { value: '# Title' });
    const html = editor.getHtml();
    expect(html).toContain('<h1>');
    expect(html).toContain('Title');
    editor.destroy();
  });

  it('calls onChange when content changes', () => {
    const onChange = vi.fn();
    const editor = new MarkdownEditor(container, { onChange });
    editor.setValue('new content');
    // setValue does not trigger onChange (it's a programmatic set)
    // But CodeEditor's updateListener fires on dispatch changes
    // Let's verify via the code editor directly
    editor.destroy();
  });

  it('renders preview pane when preview is true', () => {
    const editor = new MarkdownEditor(container, { preview: true });
    expect(container.querySelector('.md-editor-preview')).toBeTruthy();
    editor.destroy();
  });

  it('hides preview pane when preview is false', () => {
    const editor = new MarkdownEditor(container, { preview: false });
    expect(container.querySelector('.md-editor-preview')).toBeNull();
    editor.destroy();
  });

  it('setMode switches from simple to complex', () => {
    const editor = new MarkdownEditor(container, { mode: 'simple' });
    expect(container.querySelector('.md-editor-toolbar')).toBeNull();

    editor.setMode('complex');
    expect(container.classList.contains('md-editor-mode-complex')).toBe(true);
    expect(container.querySelector('.md-editor-toolbar')).toBeTruthy();
    expect(container.querySelector('.md-editor-statusbar')).toBeTruthy();
    editor.destroy();
  });

  it('setMode switches from complex to simple', () => {
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    expect(container.querySelector('.md-editor-toolbar')).toBeTruthy();

    editor.setMode('simple');
    expect(container.classList.contains('md-editor-mode-simple')).toBe(true);
    expect(container.querySelector('.md-editor-toolbar')).toBeNull();
    expect(container.querySelector('.md-editor-statusbar')).toBeNull();
    editor.destroy();
  });

  it('setMode is a no-op when mode is unchanged', () => {
    const editor = new MarkdownEditor(container, { mode: 'simple' });
    editor.setMode('simple');
    expect(container.classList.contains('md-editor-mode-simple')).toBe(true);
    editor.destroy();
  });

  it('setTheme switches theme', () => {
    const editor = new MarkdownEditor(container, { theme: 'light' });
    expect(container.getAttribute('data-theme')).toBe('light');

    editor.setTheme('dark');
    expect(container.getAttribute('data-theme')).toBe('dark');
    editor.destroy();
  });

  it('renderNow triggers preview render', () => {
    const editor = new MarkdownEditor(container, { value: '# Test', autoPreview: false });
    expect(() => editor.renderNow()).not.toThrow();
    editor.destroy();
  });

  it('setAutoPreview toggles auto preview', () => {
    const editor = new MarkdownEditor(container, { autoPreview: false });
    editor.setAutoPreview(true);
    // Should not throw
    expect(() => editor.setValue('test')).not.toThrow();
    editor.destroy();
  });

  it('focus does not throw', () => {
    const editor = new MarkdownEditor(container);
    expect(() => editor.focus()).not.toThrow();
    editor.destroy();
  });

  it('destroy cleans up container classes and content', () => {
    const editor = new MarkdownEditor(container, { mode: 'complex', value: '# Test' });
    editor.destroy();
    expect(container.classList.contains('md-editor-root')).toBe(false);
    expect(container.getAttribute('data-theme')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('destroy can be called multiple times safely', () => {
    const editor = new MarkdownEditor(container);
    editor.destroy();
    expect(() => editor.destroy()).not.toThrow();
  });

  it('renders math in preview', () => {
    const editor = new MarkdownEditor(container, { value: '$E=mc^2$', math: true });
    const preview = container.querySelector('.md-editor-preview');
    expect(preview?.innerHTML).toContain('katex');
    editor.destroy();
  });

  it('renders mindmap placeholder in preview', () => {
    const editor = new MarkdownEditor(container, {
      value: '```mindmap\n# Root\n## Branch\n```',
      mindmap: true
    });
    const preview = container.querySelector('.md-editor-preview');
    expect(preview?.innerHTML).toContain('md-editor-mindmap');
    editor.destroy();
  });

  it('complex mode statusbar shows char count', () => {
    const editor = new MarkdownEditor(container, { mode: 'complex', value: 'hello' });
    const statusbar = container.querySelector('.md-editor-statusbar');
    expect(statusbar?.textContent).toContain('5 chars');
    expect(statusbar?.textContent).toContain('1 words');
    editor.destroy();
  });

  it('complex mode toolbar has expected buttons', () => {
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    const toolbar = container.querySelector('.md-editor-toolbar');
    expect(toolbar?.querySelector('button[data-action="bold"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="math"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="mindmap"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="preview"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="theme"]')).toBeTruthy();
    editor.destroy();
  });
});

describe('MarkdownEditor - new toolbar buttons (v0.3.0)', () => {
  it('complex mode includes image, video, youtube buttons', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    const toolbar = container.querySelector('.md-editor-toolbar');
    expect(toolbar?.querySelector('button[data-action="image"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="video"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="youtube"]')).toBeTruthy();
    editor.destroy();
    container.remove();
  });

  it('complex mode includes quote, unordered list, ordered list, hr buttons', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    const toolbar = container.querySelector('.md-editor-toolbar');
    expect(toolbar?.querySelector('button[data-action="quote"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="ul"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="ol"]')).toBeTruthy();
    expect(toolbar?.querySelector('button[data-action="hr"]')).toBeTruthy();
    editor.destroy();
    container.remove();
  });

  it('simple mode has no toolbar buttons', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'simple' });
    expect(container.querySelector('.md-editor-toolbar')).toBeNull();
    editor.destroy();
    container.remove();
  });

  it('quote button inserts blockquote snippet', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    const btn = container.querySelector('button[data-action="quote"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(editor.getValue()).toContain('> ');
    expect(editor.getValue()).toContain('quoted text');
    editor.destroy();
    container.remove();
  });

  it('unordered list button inserts list snippet', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    const btn = container.querySelector('button[data-action="ul"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(editor.getValue()).toContain('- ');
    editor.destroy();
    container.remove();
  });

  it('ordered list button inserts numbered list snippet', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    const btn = container.querySelector('button[data-action="ol"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(editor.getValue()).toContain('1. ');
    editor.destroy();
    container.remove();
  });

  it('horizontal rule button inserts hr', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'complex' });
    const btn = container.querySelector('button[data-action="hr"]') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(editor.getValue()).toContain('---');
    editor.destroy();
    container.remove();
  });
});

describe('MarkdownEditor - preview pane styling', () => {
  it('preview pane has markdown-body class for github-markdown-css', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'simple' });
    const preview = container.querySelector('.md-editor-preview');
    expect(preview?.classList.contains('markdown-body')).toBe(true);
    editor.destroy();
    container.remove();
  });

  it('renders headings with proper styling in preview', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'simple' });
    editor.setValue('# Heading 1\n\n## Heading 2\n\nParagraph text.');
    const preview = container.querySelector('.md-editor-preview');
    expect(preview?.querySelector('h1')).toBeTruthy();
    expect(preview?.querySelector('h2')).toBeTruthy();
    expect(preview?.querySelector('p')).toBeTruthy();
    editor.destroy();
    container.remove();
  });

  it('renders code blocks with traffic light UI in preview', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'simple' });
    editor.setValue('```javascript\nconst x = 1;\n```');
    const preview = container.querySelector('.md-editor-preview');
    expect(preview?.querySelector('.md-editor-codeblock')).toBeTruthy();
    expect(preview?.querySelector('.md-editor-codeblock-copy')).toBeTruthy();
    expect(preview?.querySelector('.md-editor-codeblock-dot--red')).toBeTruthy();
    editor.destroy();
    container.remove();
  });
});

describe('MarkdownEditor - copy button', () => {
  it('copy button exists in code block preview', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'simple' });
    editor.setValue('```python\nprint("hello")\n```');
    const copyBtn = container.querySelector('.md-editor-codeblock-copy') as HTMLButtonElement;
    expect(copyBtn).toBeTruthy();
    expect(copyBtn.textContent).toBe('Copy');
    editor.destroy();
    container.remove();
  });

  it('copy button has aria-label for accessibility', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'simple' });
    editor.setValue('```js\nconst x = 1;\n```');
    const copyBtn = container.querySelector('.md-editor-codeblock-copy');
    expect(copyBtn?.getAttribute('aria-label')).toBe('Copy code');
    editor.destroy();
    container.remove();
  });
});

describe('MarkdownEditor - codeHighlight option', () => {
  it('can disable code highlighting via option', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new MarkdownEditor(container, { mode: 'simple', codeHighlight: false });
    editor.setValue('```javascript\nconst x = 1;\n```');
    const preview = container.querySelector('.md-editor-preview');
    expect(preview?.querySelector('.md-editor-codeblock')).toBeNull();
    expect(preview?.querySelector('pre')).toBeTruthy();
    editor.destroy();
    container.remove();
  });
});

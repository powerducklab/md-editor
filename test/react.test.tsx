import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownEditorReact } from '../src/react/MarkdownEditor.js';

describe('MarkdownEditorReact', () => {
  it('renders a container div', () => {
    render(<MarkdownEditorReact />);
    const root = document.querySelector('.md-editor-root');
    expect(root).toBeTruthy();
  });

  it('applies className to container', () => {
    render(<MarkdownEditorReact className="my-editor" />);
    const root = document.querySelector('.md-editor-root');
    expect(root?.classList.contains('my-editor')).toBe(true);
  });

  it('applies style to container', () => {
    render(<MarkdownEditorReact style={{ width: '500px' }} />);
    const root = document.querySelector('.md-editor-root') as HTMLElement;
    expect(root.style.width).toBe('500px');
  });

  it('initializes with defaultValue', () => {
    render(<MarkdownEditorReact defaultValue="# Initial" />);
    const root = document.querySelector('.md-editor-root');
    expect(root).toBeTruthy();
  });

  it('initializes in complex mode with toolbar', () => {
    render(<MarkdownEditorReact mode="complex" />);
    expect(document.querySelector('.md-editor-toolbar')).toBeTruthy();
    expect(document.querySelector('.md-editor-statusbar')).toBeTruthy();
  });

  it('initializes in simple mode without toolbar', () => {
    render(<MarkdownEditorReact mode="simple" />);
    expect(document.querySelector('.md-editor-toolbar')).toBeNull();
    expect(document.querySelector('.md-editor-statusbar')).toBeNull();
  });

  it('sets dark theme', () => {
    render(<MarkdownEditorReact theme="dark" />);
    const root = document.querySelector('.md-editor-root');
    expect(root?.getAttribute('data-theme')).toBe('dark');
  });

  it('disables preview when preview=false', () => {
    render(<MarkdownEditorReact preview={false} />);
    expect(document.querySelector('.md-editor-preview')).toBeNull();
  });

  it('renders math content in preview', () => {
    render(<MarkdownEditorReact defaultValue="$E=mc^2$" math={true} />);
    const preview = document.querySelector('.md-editor-preview');
    expect(preview?.innerHTML).toContain('katex');
  });

  it('unmount destroys the editor instance', () => {
    const { unmount } = render(<MarkdownEditorReact />);
    const root = document.querySelector('.md-editor-root');
    expect(root).toBeTruthy();
    unmount();
    // After unmount, the container is removed from DOM
    expect(document.querySelector('.md-editor-root')).toBeNull();
  });

  it('passes mention and docLink config through to the editor', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <MarkdownEditorReact
        mode="complex"
        mention={{ onMentionSearch: async () => [{ id: '1', label: 'Alice' }] }}
        docLink={{ onDocSearch: async () => [{ id: 'd1', title: 'Doc', url: 'https://example.com' }] }}
      />
    );
    // With mention configured, clicking the mention toolbar button should NOT
    // log a "dropdown is disabled" warning.
    const btn = document.querySelector('button[data-action="mention"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Mention dropdown is disabled'),
    );
    warnSpy.mockRestore();
  });
});

import { describe, expect, it } from 'vitest';
import { countText, StatusBar } from '../src/StatusBar.js';

describe('countText', () => {
  it('counts characters including whitespace', () => {
    expect(countText('hello').charCount).toBe(5);
    expect(countText('hello world').charCount).toBe(11);
  });

  it('counts words by splitting on whitespace', () => {
    expect(countText('hello world').wordCount).toBe(2);
    expect(countText('one two three').wordCount).toBe(3);
  });

  it('returns zero words for empty or whitespace-only string', () => {
    expect(countText('').wordCount).toBe(0);
    expect(countText('   ').wordCount).toBe(0);
    expect(countText('\n\t').wordCount).toBe(0);
  });

  it('handles multiple consecutive spaces as one separator', () => {
    expect(countText('a   b').wordCount).toBe(2);
  });

  it('counts CJK text as characters (each char is one)', () => {
    // CJK characters via unicode escape to keep source ASCII-only
    const cjk = '\u4f60\u597d\u4e16\u754c';
    expect(countText(cjk).charCount).toBe(4);
    // CJK without spaces is one "word"
    expect(countText(cjk).wordCount).toBe(1);
  });

  it('charCount includes leading/trailing whitespace', () => {
    expect(countText('  hello  ').charCount).toBe(9);
  });
});

describe('StatusBar', () => {
  it('creates a div with the correct class', () => {
    const sb = new StatusBar({ onRefreshPreview: () => {} });
    expect(sb.el.tagName).toBe('DIV');
    expect(sb.el.className).toBe('md-editor-statusbar');
  });

  it('updates char and word counts', () => {
    const sb = new StatusBar({ onRefreshPreview: () => {} });
    sb.update({
      charCount: 100,
      wordCount: 20,
      blockCount: 5,
      mode: 'complex',
      autoPreview: true
    });
    expect(sb.el.textContent).toContain('100 chars');
    expect(sb.el.textContent).toContain('20 words');
    expect(sb.el.textContent).toContain('5 render blocks');
  });

  it('hides refresh button when autoPreview is true', () => {
    const sb = new StatusBar({ onRefreshPreview: () => {} });
    sb.update({ charCount: 0, wordCount: 0, blockCount: 0, mode: 'complex', autoPreview: true });
    const btn = sb.el.querySelector('.md-editor-statusbar-refresh') as HTMLButtonElement;
    expect(btn.style.display).toBe('none');
  });

  it('shows refresh button when autoPreview is false', () => {
    const sb = new StatusBar({ onRefreshPreview: () => {} });
    sb.update({ charCount: 0, wordCount: 0, blockCount: 0, mode: 'complex', autoPreview: false });
    const btn = sb.el.querySelector('.md-editor-statusbar-refresh') as HTMLButtonElement;
    expect(btn.style.display).not.toBe('none');
  });

  it('calls onRefreshPreview when refresh button is clicked', () => {
    let clicked = false;
    const sb = new StatusBar({ onRefreshPreview: () => { clicked = true; } });
    const btn = sb.el.querySelector('.md-editor-statusbar-refresh') as HTMLButtonElement;
    btn.click();
    expect(clicked).toBe(true);
  });

  it('remove detaches the element from DOM', () => {
    const parent = document.createElement('div');
    const sb = new StatusBar({ onRefreshPreview: () => {} });
    parent.appendChild(sb.el);
    expect(parent.children).toHaveLength(1);
    sb.destroy();
    expect(parent.children).toHaveLength(0);
  });
});

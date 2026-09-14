import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  matchShortcut,
  formatShortcut,
  formatShortcutHtml
} from '../src/plugins/keyboard.js';

describe('DEFAULT_SHORTCUTS', () => {
  it('contains expected shortcuts', () => {
    const actions = DEFAULT_SHORTCUTS.map((s) => s.action);
    expect(actions).toContain('bold');
    expect(actions).toContain('italic');
    expect(actions).toContain('heading');
    expect(actions).toContain('link');
    expect(actions).toContain('code');
    expect(actions).toContain('preview');
    expect(actions).toContain('theme');
  });

  it('every shortcut has a description', () => {
    for (const s of DEFAULT_SHORTCUTS) {
      expect(s.description).toBeTruthy();
      expect(s.key).toBeTruthy();
    }
  });

  it('action names are unique', () => {
    const actions = DEFAULT_SHORTCUTS.map((s) => s.action);
    expect(new Set(actions).size).toBe(actions.length);
  });
});

describe('matchShortcut', () => {
  it('matches Mod-b with ctrlKey on non-mac', () => {
    const e = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'b' } as KeyboardEvent;
    expect(matchShortcut('Mod-b', e)).toBe(true);
  });

  it('does not match Mod-b without ctrlKey', () => {
    const e = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: 'b' } as KeyboardEvent;
    expect(matchShortcut('Mod-b', e)).toBe(false);
  });

  it('matches Mod-Shift-. with ctrl+shift+.', () => {
    const e = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: '.' } as KeyboardEvent;
    expect(matchShortcut('Mod-Shift-.', e)).toBe(true);
  });

  it('does not match when wrong key', () => {
    const e = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'i' } as KeyboardEvent;
    expect(matchShortcut('Mod-b', e)).toBe(false);
  });

  it('matches Alt modifier', () => {
    const e = { ctrlKey: true, metaKey: false, altKey: true, shiftKey: false, key: '1' } as KeyboardEvent;
    expect(matchShortcut('Mod-Alt-1', e)).toBe(true);
  });

  it('does not match when extra modifier present', () => {
    const e = { ctrlKey: true, metaKey: false, altKey: true, shiftKey: false, key: 'b' } as KeyboardEvent;
    expect(matchShortcut('Mod-b', e)).toBe(false);
  });
});

describe('formatShortcut', () => {
  it('formats Mod-b as Ctrl+B on non-mac', () => {
    const result = formatShortcut('Mod-b');
    // On Linux (test env), Mod maps to Ctrl
    expect(result).toBe('Ctrl+B');
  });

  it('formats multi-key shortcuts', () => {
    const result = formatShortcut('Mod-Shift-8');
    expect(result).toContain('Ctrl');
    expect(result).toContain('Shift');
    expect(result).toContain('8');
  });

  it('formats Alt key', () => {
    const result = formatShortcut('Mod-Alt-m');
    expect(result).toContain('Alt');
    expect(result).toContain('M');
  });
});

describe('formatShortcutHtml', () => {
  it('returns HTML with kbd elements', () => {
    const html = formatShortcutHtml('Mod-b');
    expect(html).toContain('md-editor-kbd');
    expect(html).toContain('Ctrl');
    expect(html).toContain('B');
  });

  it('includes plus separators between keys', () => {
    const html = formatShortcutHtml('Mod-Shift-8');
    expect(html).toContain('md-editor-kbd-plus');
  });

  it('includes symbol span for shift', () => {
    const html = formatShortcutHtml('Mod-Shift-8');
    expect(html).toContain('md-editor-kbd-symbol');
    expect(html).toContain('⇧');
  });

  it('handles Alt key', () => {
    const html = formatShortcutHtml('Mod-Alt-m');
    expect(html).toContain('Alt');
    expect(html).toContain('M');
  });

  it('handles single key', () => {
    const html = formatShortcutHtml('b');
    expect(html).toContain('md-editor-kbd');
    expect(html).toContain('B');
  });
});

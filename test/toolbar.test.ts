import { describe, expect, it } from 'vitest';
import { Toolbar, type ToolbarAction } from '../src/Toolbar.js';

const icon = '<svg></svg>';

function makeActions(): ToolbarAction[] {
  return [
    { name: 'bold', title: 'Bold', icon, handler: () => {} },
    { name: 'italic', title: 'Italic', icon, handler: () => {}, groupEnd: true },
    { name: 'preview', title: 'Preview', icon, handler: () => {}, toggle: true, active: true }
  ];
}

describe('Toolbar', () => {
  it('creates a div with toolbar role', () => {
    const tb = new Toolbar(makeActions());
    expect(tb.el.tagName).toBe('DIV');
    expect(tb.el.className).toBe('md-editor-toolbar');
    expect(tb.el.getAttribute('role')).toBe('toolbar');
  });

  it('creates a button for each action', () => {
    const tb = new Toolbar(makeActions());
    expect(tb.el.querySelectorAll('button')).toHaveLength(3);
  });

  it('sets button title and aria-label', () => {
    const tb = new Toolbar(makeActions());
    const btn = tb.el.querySelector('button[data-action="bold"]') as HTMLButtonElement;
    expect(btn.title).toBe('Bold');
    expect(btn.getAttribute('aria-label')).toBe('Bold');
  });

  it('sets button innerHTML to icon', () => {
    const tb = new Toolbar(makeActions());
    const btn = tb.el.querySelector('button[data-action="bold"]') as HTMLButtonElement;
    expect(btn.innerHTML).toBe(icon);
  });

  it('adds is-toggle class for toggle buttons', () => {
    const tb = new Toolbar(makeActions());
    const btn = tb.el.querySelector('button[data-action="preview"]') as HTMLButtonElement;
    expect(btn.classList.contains('is-toggle')).toBe(true);
  });

  it('adds is-active class when active is true', () => {
    const tb = new Toolbar(makeActions());
    const btn = tb.el.querySelector('button[data-action="preview"]') as HTMLButtonElement;
    expect(btn.classList.contains('is-active')).toBe(true);
  });

  it('does not add is-active when active is false/undefined', () => {
    const tb = new Toolbar(makeActions());
    const btn = tb.el.querySelector('button[data-action="bold"]') as HTMLButtonElement;
    expect(btn.classList.contains('is-active')).toBe(false);
  });

  it('adds separator after groupEnd actions', () => {
    const tb = new Toolbar(makeActions());
    expect(tb.el.querySelectorAll('.md-editor-toolbar-sep')).toHaveLength(1);
  });

  it('calls handler on mousedown (not click, to preserve editor selection)', () => {
    let clicked = false;
    const actions: ToolbarAction[] = [
      { name: 'test', title: 'Test', icon, handler: () => { clicked = true; } }
    ];
    const tb = new Toolbar(actions);
    const btn = tb.el.querySelector('button') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(clicked).toBe(true);
  });

  it('mousedown handler calls preventDefault to prevent editor focus loss', () => {
    const actions: ToolbarAction[] = [
      { name: 'test', title: 'Test', icon, handler: () => {} }
    ];
    const tb = new Toolbar(actions);
    const btn = tb.el.querySelector('button') as HTMLButtonElement;
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    btn.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('setActive toggles the is-active class', () => {
    const tb = new Toolbar(makeActions());
    tb.setActive('bold', true);
    const btn = tb.el.querySelector('button[data-action="bold"]') as HTMLButtonElement;
    expect(btn.classList.contains('is-active')).toBe(true);

    tb.setActive('bold', false);
    expect(btn.classList.contains('is-active')).toBe(false);
  });

  it('setActive does nothing for unknown button', () => {
    const tb = new Toolbar(makeActions());
    expect(() => tb.setActive('nonexistent', true)).not.toThrow();
  });

  it('setIcon updates button innerHTML', () => {
    const tb = new Toolbar(makeActions());
    const newIcon = '<svg id="new"></svg>';
    tb.setIcon('bold', newIcon);
    const btn = tb.el.querySelector('button[data-action="bold"]') as HTMLButtonElement;
    expect(btn.innerHTML).toBe(newIcon);
  });

  it('setIcon does nothing for unknown button', () => {
    const tb = new Toolbar(makeActions());
    expect(() => tb.setIcon('nonexistent', '<svg></svg>')).not.toThrow();
  });

  it('destroy removes the toolbar from DOM', () => {
    const parent = document.createElement('div');
    const tb = new Toolbar(makeActions());
    parent.appendChild(tb.el);
    expect(parent.children).toHaveLength(1);
    tb.destroy();
    expect(parent.children).toHaveLength(0);
  });

  it('handles empty actions array', () => {
    const tb = new Toolbar([]);
    expect(tb.el.querySelectorAll('button')).toHaveLength(0);
    expect(tb.el.querySelectorAll('.md-editor-toolbar-sep')).toHaveLength(0);
  });
});

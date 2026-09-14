import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popup } from '../src/plugins/popup.js';

function createAnchor(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = 'anchor';
  document.body.appendChild(btn);
  return btn;
}

describe('Popup', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a popup element with title', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Insert image',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    expect(popup.el).toBeInstanceOf(HTMLDivElement);
    expect(popup.el.className).toContain('md-editor-popup');
    expect(popup.el.querySelector('.md-editor-popup-header')?.textContent).toBe('Insert image');
    popup.destroy();
  });

  it('creates input fields from config', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [
        { name: 'url', label: 'Image URL', placeholder: 'https://...' },
        { name: 'alt', label: 'Alt text' }
      ],
      onSubmit: () => {}
    });
    const inputs = popup.el.querySelectorAll('.md-editor-popup-input');
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).placeholder).toBe('https://...');
    const labels = popup.el.querySelectorAll('.md-editor-popup-label');
    expect(labels[0]?.textContent).toBe('Image URL');
    expect(labels[1]?.textContent).toBe('Alt text');
    popup.destroy();
  });

  it('creates a textarea for textarea field type', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'desc', label: 'Description', type: 'textarea' }],
      onSubmit: () => {}
    });
    const textarea = popup.el.querySelector('textarea');
    expect(textarea).toBeTruthy();
    popup.destroy();
  });

  it('shows and appends to body', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    expect(document.body.contains(popup.el)).toBe(false);
    popup.show();
    expect(document.body.contains(popup.el)).toBe(true);
    popup.destroy();
  });

  it('hides and removes from body', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    popup.show();
    expect(document.body.contains(popup.el)).toBe(true);
    popup.hide();
    expect(document.body.contains(popup.el)).toBe(false);
    popup.destroy();
  });

  it('calls onSubmit with field values on submit button click', () => {
    const anchor = createAnchor();
    const onSubmit = vi.fn();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [
        { name: 'url', label: 'URL' },
        { name: 'alt', label: 'Alt' }
      ],
      onSubmit
    });
    popup.show();
    const inputs = popup.el.querySelectorAll('.md-editor-popup-input');
    (inputs[0] as HTMLInputElement).value = 'https://example.com/pic.png';
    (inputs[1] as HTMLInputElement).value = 'A picture';
    const submitBtn = popup.el.querySelector('.md-editor-popup-btn--primary') as HTMLButtonElement;
    submitBtn.click();
    expect(onSubmit).toHaveBeenCalledWith({
      url: 'https://example.com/pic.png',
      alt: 'A picture'
    });
    popup.destroy();
  });

  it('trims field values on submit', () => {
    const anchor = createAnchor();
    const onSubmit = vi.fn();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit
    });
    popup.show();
    const input = popup.el.querySelector('.md-editor-popup-input') as HTMLInputElement;
    input.value = '  https://example.com  ';
    (popup.el.querySelector('.md-editor-popup-btn--primary') as HTMLButtonElement).click();
    expect(onSubmit).toHaveBeenCalledWith({ url: 'https://example.com' });
    popup.destroy();
  });

  it('closes on cancel button click', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    popup.show();
    const cancelBtn = popup.el.querySelector('.md-editor-popup-btn--ghost') as HTMLButtonElement;
    cancelBtn.click();
    expect(document.body.contains(popup.el)).toBe(false);
    popup.destroy();
  });

  it('closes on Escape key', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    popup.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.contains(popup.el)).toBe(false);
    popup.destroy();
  });

  it('does not close on other keys', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    popup.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(document.body.contains(popup.el)).toBe(true);
    popup.destroy();
  });

  it('submits on Enter in text input', () => {
    const anchor = createAnchor();
    const onSubmit = vi.fn();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit
    });
    popup.show();
    const input = popup.el.querySelector('.md-editor-popup-input') as HTMLInputElement;
    input.value = 'https://example.com';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSubmit).toHaveBeenCalledWith({ url: 'https://example.com' });
    popup.destroy();
  });

  it('uses custom submit label', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      submitLabel: 'Add it',
      onSubmit: () => {}
    });
    const submitBtn = popup.el.querySelector('.md-editor-popup-btn--primary');
    expect(submitBtn?.textContent).toBe('Add it');
    popup.destroy();
  });

  it('destroy is idempotent', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    popup.show();
    popup.destroy();
    expect(() => popup.destroy()).not.toThrow();
  });

  it('show after destroy is a no-op', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Test',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    popup.destroy();
    popup.show();
    expect(document.body.contains(popup.el)).toBe(false);
  });

  it('sets role and aria-label for accessibility', () => {
    const anchor = createAnchor();
    const popup = new Popup(anchor, {
      title: 'Insert image',
      fields: [{ name: 'url', label: 'URL' }],
      onSubmit: () => {}
    });
    expect(popup.el.getAttribute('role')).toBe('dialog');
    expect(popup.el.getAttribute('aria-label')).toBe('Insert image');
    popup.destroy();
  });
});

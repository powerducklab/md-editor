/**
 * Keyboard shortcut manager for the editor.
 * Maps key combinations to action names. Used by the toolbar to wire up
 * shortcuts and by the Help dialog to display them.
 */

export interface ShortcutDef {
  action: string;
  /** e.g. 'Mod-b' where Mod = Ctrl on Windows/Linux, Cmd on macOS */
  key: string;
  description: string;
}

export const DEFAULT_SHORTCUTS: readonly ShortcutDef[] = [
  { action: 'bold', key: 'Mod-b', description: 'Bold' },
  { action: 'italic', key: 'Mod-i', description: 'Italic' },
  { action: 'heading', key: 'Mod-Alt-1', description: 'Heading' },
  { action: 'link', key: 'Mod-k', description: 'Insert link' },
  { action: 'code', key: 'Mod-Alt-c', description: 'Code block' },
  { action: 'quote', key: 'Mod-Shift-.', description: 'Blockquote' },
  { action: 'ul', key: 'Mod-Shift-8', description: 'Unordered list' },
  { action: 'ol', key: 'Mod-Shift-7', description: 'Ordered list' },
  { action: 'tasklist', key: 'Mod-Shift-9', description: 'Task list' },
  { action: 'math', key: 'Mod-Alt-m', description: 'Math formula' },
  { action: 'preview', key: 'Mod-Alt-p', description: 'Toggle preview' },
  { action: 'theme', key: 'Mod-Shift-l', description: 'Toggle theme' }
];

/**
 * Parse a shortcut string like 'Mod-b' or 'Mod-Alt-1' into a matcher function.
 * 'Mod' maps to Meta (Cmd) on macOS and Ctrl elsewhere.
 */
export function matchShortcut(shortcut: string, e: KeyboardEvent): boolean {
  const parts = shortcut.toLowerCase().split('-');
  let key = '';
  let needCtrl = false;
  let needMeta = false;
  let needAlt = false;
  let needShift = false;

  for (const part of parts) {
    switch (part) {
      case 'mod':
        if (navigator.platform?.toLowerCase().includes('mac')) {
          needMeta = true;
        } else {
          needCtrl = true;
        }
        break;
      case 'ctrl':
        needCtrl = true;
        break;
      case 'meta':
      case 'cmd':
        needMeta = true;
        break;
      case 'alt':
      case 'option':
        needAlt = true;
        break;
      case 'shift':
        needShift = true;
        break;
      default:
        key = part;
    }
  }

  if (e.ctrlKey !== needCtrl) return false;
  if (e.metaKey !== needMeta) return false;
  if (e.altKey !== needAlt) return false;
  if (e.shiftKey !== needShift) return false;
  if (e.key.toLowerCase() !== key) return false;
  return true;
}

/**
 * Format a shortcut for display in the Help dialog.
 * e.g. 'Mod-b' -> 'Ctrl+B' (Windows) or 'Cmd+B' (macOS)
 */
export function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform?.toLowerCase().includes('mac') ?? false;
  const parts = shortcut.split('-');
  return parts
    .map((p) => {
      switch (p.toLowerCase()) {
        case 'mod':
          return isMac ? 'Cmd' : 'Ctrl';
        case 'ctrl':
          return 'Ctrl';
        case 'meta':
        case 'cmd':
          return 'Cmd';
        case 'alt':
          return isMac ? 'Option' : 'Alt';
        case 'shift':
          return 'Shift';
        default:
          return p.toUpperCase();
      }
    })
    .join('+');
}

/**
 * Format a shortcut as HTML with styled kbd elements.
 * Modifier keys get symbol icons (⌘, ⌥, ⇧) on macOS.
 */
export function formatShortcutHtml(shortcut: string): string {
  const isMac = navigator.platform?.toLowerCase().includes('mac') ?? false;
  const parts = shortcut.split('-');
  return parts
    .map((p) => {
      let label = p;
      let symbol = '';
      switch (p.toLowerCase()) {
        case 'mod':
          label = isMac ? 'Cmd' : 'Ctrl';
          symbol = isMac ? '⌘' : '';
          break;
        case 'ctrl':
          label = 'Ctrl';
          symbol = isMac ? '⌃' : '';
          break;
        case 'meta':
        case 'cmd':
          label = 'Cmd';
          symbol = '⌘';
          break;
        case 'alt':
          label = isMac ? 'Option' : 'Alt';
          symbol = isMac ? '⌥' : '';
          break;
        case 'shift':
          label = 'Shift';
          symbol = '⇧';
          break;
        default:
          label = p.toUpperCase();
      }
      const symbolHtml = symbol ? `<span class="md-editor-kbd-symbol">${symbol}</span>` : '';
      return `<kbd class="md-editor-kbd">${symbolHtml}<span>${label}</span></kbd>`;
    })
    .join('<span class="md-editor-kbd-plus">+</span>');
}

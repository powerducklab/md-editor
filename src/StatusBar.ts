export interface StatusBarState {
  charCount: number;
  wordCount: number;
  blockCount: number;
  mode: 'simple' | 'complex';
  autoPreview: boolean;
}

export interface StatusBarCallbacks {
  onRefreshPreview: () => void;
}

/**
 * Character count is more intuitive for CJK text; word count (split on
 * whitespace) is provided for Latin-script content. Both are computed
 * directly from the current value and are cheap operations.
 */
export function countText(value: string): { charCount: number; wordCount: number } {
  const trimmed = value.trim();
  return {
    charCount: value.length,
    wordCount: trimmed ? trimmed.split(/\s+/).length : 0
  };
}

export class StatusBar {
  readonly el: HTMLDivElement;
  private countEl: HTMLSpanElement;
  private blockEl: HTMLSpanElement;
  private refreshBtn: HTMLButtonElement;

  constructor(callbacks: StatusBarCallbacks) {
    this.el = document.createElement('div');
    this.el.className = 'md-editor-statusbar';

    this.countEl = document.createElement('span');
    this.blockEl = document.createElement('span');
    this.blockEl.className = 'md-editor-statusbar-muted';

    this.refreshBtn = document.createElement('button');
    this.refreshBtn.type = 'button';
    this.refreshBtn.className = 'md-editor-statusbar-refresh';
    this.refreshBtn.textContent = 'Refresh preview';
    this.refreshBtn.style.display = 'none';
    this.refreshBtn.addEventListener('click', callbacks.onRefreshPreview);

    this.el.appendChild(this.countEl);
    this.el.appendChild(this.blockEl);
    this.el.appendChild(this.refreshBtn);
  }

  update(state: StatusBarState): void {
    this.countEl.textContent = `${state.charCount} chars \u00b7 ${state.wordCount} words`;
    this.blockEl.textContent = `${state.blockCount} render blocks`;
    this.refreshBtn.style.display = state.autoPreview ? 'none' : '';
  }

  destroy(): void {
    this.refreshBtn.onclick = null;
    this.el.remove();
  }
}

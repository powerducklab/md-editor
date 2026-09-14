export interface ToolbarAction {
  name: string;
  title: string;
  /** SVG/HTML icon markup */
  icon: string;
  handler: (button: HTMLButtonElement) => void;
  /** Append a group separator after this button */
  groupEnd?: boolean;
  /** Whether this is a toggle button (e.g. preview visibility, theme) */
  toggle?: boolean;
  active?: boolean;
}

export class Toolbar {
  readonly el: HTMLDivElement;
  private buttons = new Map<string, HTMLButtonElement>();

  constructor(actions: readonly ToolbarAction[]) {
    this.el = document.createElement('div');
    this.el.className = 'md-editor-toolbar';
    this.el.setAttribute('role', 'toolbar');

    for (const action of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'md-editor-toolbar-btn';
      if (action.toggle) btn.classList.add('is-toggle');
      if (action.active) btn.classList.add('is-active');
      btn.title = action.title;
      btn.setAttribute('aria-label', action.title);
      btn.setAttribute('data-action', action.name);
      btn.innerHTML = action.icon;
      // Use mousedown + preventDefault so the CodeMirror editor does NOT lose
      // focus (and collapse the selection) before the handler runs. Using
      // 'click' here causes the selection to collapse to a cursor on mousedown,
      // so wrapSelection/wrapLines would read an empty selection and insert
      // placeholder text instead of wrapping the user's selected text.
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        // Stop propagation so the same mousedown event does not bubble to
        // document and immediately trigger a newly-opened Popup's
        // outside-click handler (which would close the popup before the user
        // sees it, especially when clicking the SVG icon inside the button).
        e.stopPropagation();
        action.handler(btn);
      });
      this.buttons.set(action.name, btn);
      this.el.appendChild(btn);

      if (action.groupEnd) {
        const sep = document.createElement('span');
        sep.className = 'md-editor-toolbar-sep';
        this.el.appendChild(sep);
      }
    }
  }

  setActive(name: string, active: boolean): void {
    this.buttons.get(name)?.classList.toggle('is-active', active);
  }

  setIcon(name: string, icon: string): void {
    const btn = this.buttons.get(name);
    if (btn) btn.innerHTML = icon;
  }

  destroy(): void {
    for (const btn of this.buttons.values()) {
      // ToolbarAction handlers are closures owned by the editor instance;
      // removing listeners is not strictly necessary because the DOM subtree
      // is discarded, but we clear onclick references defensively.
      btn.onclick = null;
    }
    this.buttons.clear();
    this.el.remove();
  }
}

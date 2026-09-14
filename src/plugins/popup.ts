export interface PopupField {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea';
  required?: boolean;
}

export interface PopupConfig {
  title: string;
  fields: readonly PopupField[];
  submitLabel?: string;
  theme?: 'light' | 'dark';
  onSubmit: (values: Record<string, string>) => void;
}

/**
 * A lightweight floating popup panel anchored to a toolbar button.
 * Used for image / video / YouTube insertion dialogs.
 * Closes on outside click, Escape key, or successful submit.
 */
export class Popup {
  readonly el: HTMLDivElement;
  private anchor: HTMLElement;
  private config: PopupConfig;
  private inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
  private onOutsideClick: (e: MouseEvent) => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private destroyed = false;

  constructor(anchor: HTMLElement, config: PopupConfig) {
    this.anchor = anchor;
    this.config = config;

    this.el = document.createElement('div');
    this.el.className = 'md-editor-popup';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', config.title);
    if (config.theme) this.el.setAttribute('data-theme', config.theme);

    this.build();

    this.onOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!this.el.contains(target) && !this.anchor.contains(target)) {
        this.hide();
      }
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
  }

  private build(): void {
    const header = document.createElement('div');
    header.className = 'md-editor-popup-header';
    header.textContent = this.config.title;

    const body = document.createElement('div');
    body.className = 'md-editor-popup-body';

    for (const field of this.config.fields) {
      const wrapper = document.createElement('div');
      wrapper.className = 'md-editor-popup-field';

      const label = document.createElement('label');
      label.className = 'md-editor-popup-label';
      label.textContent = field.label;
      label.setAttribute('for', `md-editor-popup-${field.name}`);

      let input: HTMLInputElement | HTMLTextAreaElement;
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
        (input as HTMLTextAreaElement).rows = 2;
      } else {
        input = document.createElement('input');
        input.type = 'text';
      }
      input.id = `md-editor-popup-${field.name}`;
      input.className = 'md-editor-popup-input';
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.required) input.required = true;

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      body.appendChild(wrapper);
      this.inputs.set(field.name, input);
    }

    const footer = document.createElement('div');
    footer.className = 'md-editor-popup-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'md-editor-popup-btn md-editor-popup-btn--ghost';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.hide());

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'md-editor-popup-btn md-editor-popup-btn--primary';
    submitBtn.textContent = this.config.submitLabel ?? 'Insert';
    submitBtn.addEventListener('click', () => this.submit());

    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);

    this.el.appendChild(header);
    this.el.appendChild(body);
    this.el.appendChild(footer);

    // Submit on Enter in text inputs
    for (const input of this.inputs.values()) {
      if (input.tagName === 'INPUT') {
        input.addEventListener('keydown', ((e: Event) => {
          const ke = e as KeyboardEvent;
          if (ke.key === 'Enter') {
            ke.preventDefault();
            this.submit();
          }
        }) as EventListener);
      }
    }
  }

  private submit(): void {
    const values: Record<string, string> = {};
    for (const [name, input] of this.inputs) {
      values[name] = input.value.trim();
    }
    this.config.onSubmit(values);
    this.hide();
  }

  show(): void {
    if (this.destroyed) return;
    document.body.appendChild(this.el);
    this.position();
    document.addEventListener('mousedown', this.onOutsideClick);
    document.addEventListener('keydown', this.onKeyDown);
    // Focus first input
    const firstInput = this.inputs.values().next().value;
    firstInput?.focus();
  }

  hide(): void {
    if (this.destroyed) return;
    this.el.remove();
    document.removeEventListener('mousedown', this.onOutsideClick);
    document.removeEventListener('keydown', this.onKeyDown);
  }

  private position(): void {
    const anchorRect = this.anchor.getBoundingClientRect();
    const popupRect = this.el.getBoundingClientRect();

    let left = anchorRect.left;
    const top = anchorRect.bottom + 6;

    // Keep within viewport
    if (left + popupRect.width > window.innerWidth - 8) {
      left = window.innerWidth - popupRect.width - 8;
    }
    if (left < 8) left = 8;

    this.el.style.left = `${left + window.scrollX}px`;
    this.el.style.top = `${top + window.scrollY}px`;
  }

  destroy(): void {
    this.hide();
    this.destroyed = true;
    this.inputs.clear();
  }
}

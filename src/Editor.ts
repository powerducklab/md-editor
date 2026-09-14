import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { markdownLightHighlight, markdownDarkHighlight } from './plugins/syntax-highlight.js';
import { MentionController, type MentionOptions } from './plugins/mention.js';
import { DocLinkController, type DocLinkOptions } from './plugins/doclink.js';

export type EditorTheme = 'light' | 'dark';

export interface CodeEditorOptions {
  value: string;
  onChange?: (value: string) => void;
  /** Show line numbers. Off in simple mode, on in complex mode by default. */
  lineNumbers?: boolean;
  placeholder?: string;
  /** Called when an image file is pasted or dropped into the editor. */
  onImageFile?: (file: File) => void;
  /** @mention dropdown configuration */
  mention?: MentionOptions;
  /** Document link inserter configuration */
  docLink?: DocLinkOptions;
  /** Initial color theme for syntax highlighting. Defaults to 'light'. */
  theme?: EditorTheme;
}

export class CodeEditor {
  readonly view: EditorView;
  private lineNumbersCompartment = new Compartment();
  private customKeymapCompartment = new Compartment();
  private highlightCompartment = new Compartment();
  private onImageFile?: (file: File) => void;
  private mention: MentionController | null = null;
  private docLink: DocLinkController | null = null;
  private blurTimeout: number | null = null;
  private destroyed = false;
  private theme: EditorTheme;

  constructor(container: HTMLElement, options: CodeEditorOptions) {
    this.onImageFile = options.onImageFile;
    this.theme = options.theme ?? 'light';

    const highlightStyle =
      this.theme === 'dark' ? markdownDarkHighlight : markdownLightHighlight;

    const extensions = [
      history(),
      // High-priority keymap: handle dropdown navigation/selection BEFORE
      // CodeMirror's default keymap inserts newlines or moves the cursor.
      keymap.of([
        {
          key: "Enter",
          run: () => {
            if (this.mention?.isOpen()) {
              this.mention.selectCurrent();
              return true;
            }
            if (this.docLink?.isOpen()) {
              this.docLink.selectCurrent();
              return true;
            }
            return false;
          },
        },
        {
          key: "ArrowDown",
          run: () => {
            if (this.mention?.isOpen() || this.docLink?.isOpen()) {
              const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
              this.mention?.handleKey(event);
              this.docLink?.handleKey(event);
              return true;
            }
            return false;
          },
        },
        {
          key: "ArrowUp",
          run: () => {
            if (this.mention?.isOpen() || this.docLink?.isOpen()) {
              const event = new KeyboardEvent("keydown", { key: "ArrowUp" });
              this.mention?.handleKey(event);
              this.docLink?.handleKey(event);
              return true;
            }
            return false;
          },
        },
        {
          key: "Escape",
          run: () => {
            if (this.mention?.isOpen()) {
              this.mention.hide();
              return true;
            }
            if (this.docLink?.isOpen()) {
              this.docLink.hide();
              return true;
            }
            return false;
          },
        },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      this.customKeymapCompartment.of([]),
      markdown({ codeLanguages: languages }),
      this.highlightCompartment.of(highlightStyle),
      EditorView.lineWrapping,
      this.lineNumbersCompartment.of(options.lineNumbers ? lineNumbers() : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          options.onChange?.(update.state.doc.toString());
        }
        if (update.docChanged || update.selectionSet) {
          this.mention?.update();
          this.docLink?.update();
        }
      }),
      // Close dropdowns when the editor loses focus
      EditorView.domEventHandlers({
        paste: (event) => this.handlePaste(event),
        drop: (event) => this.handleDrop(event),
        blur: () => {
          // Delay so a click on the dropdown itself can register first
          this.blurTimeout = window.setTimeout(() => {
            this.blurTimeout = null;
            if (this.destroyed) return;
            if (!this.view.dom.contains(document.activeElement)) {
              this.mention?.hide();
              this.docLink?.hide();
            }
          }, 150);
        },
        keydown: (event) => {
          if (this.mention?.handleKey(event)) return true;
          if (this.docLink?.handleKey(event)) return true;
          return false;
        }
      })
    ];

    this.view = new EditorView({
      state: EditorState.create({ doc: options.value ?? '', extensions }),
      parent: container
    });

    if (options.mention?.onMentionSearch) {
      this.mention = new MentionController(this.view, options.mention);
    }
    if (options.docLink?.onDocSearch) {
      this.docLink = new DocLinkController(this.view, options.docLink);
    }
  }

  private handlePaste(event: ClipboardEvent): boolean {
    const items = event.clipboardData?.items;
    if (!items) return false;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          this.onImageFile?.(file);
          event.preventDefault();
          return true;
        }
      }
    }
    return false;
  }

  private handleDrop(event: DragEvent): boolean {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return false;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        this.onImageFile?.(file);
        event.preventDefault();
        return true;
      }
    }
    return false;
  }

  /**
   * Register custom keyboard shortcuts. Each entry is a CodeMirror keymap
   * spec: { key: 'Mod-b', run: (view) => boolean }.
   */
  setKeymap(bindings: Array<{ key: string; run: (view: EditorView) => boolean }>): void {
    this.view.dispatch({
      effects: this.customKeymapCompartment.reconfigure(keymap.of(bindings))
    });
  }

  getValue(): string {
    return this.view.state.doc.toString();
  }

  setValue(value: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: value }
    });
  }

  setLineNumbers(enabled: boolean): void {
    this.view.dispatch({
      effects: this.lineNumbersCompartment.reconfigure(enabled ? lineNumbers() : [])
    });
  }

  /**
   * Switch the syntax highlighting theme. Reconfigures only the highlight
   * compartment — the document and view state are preserved, so this is
   * effectively free on large documents.
   */
  setTheme(theme: EditorTheme): void {
    if (this.theme === theme) return;
    this.theme = theme;
    const style = theme === 'dark' ? markdownDarkHighlight : markdownLightHighlight;
    this.view.dispatch({
      effects: this.highlightCompartment.reconfigure(style)
    });
  }

  insertAtCursor(text: string): void {
    const { from, to } = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length }
    });
    this.view.focus();
  }

  /**
   * Wrap the current selection with prefix and suffix. If nothing is
   * selected, insert prefix + placeholder + suffix and select the placeholder.
   */
  wrapSelection(prefix: string, suffix: string, placeholder: string): void {
    const { from, to } = this.view.state.selection.main;
    const selected = this.view.state.doc.sliceString(from, to);
    const content = selected || placeholder;
    const insertText = `${prefix}${content}${suffix}`;

    this.view.dispatch({
      changes: { from, to, insert: insertText },
      selection: {
        anchor: from + prefix.length,
        head: from + prefix.length + content.length
      }
    });
    this.view.focus();
  }

  getSelection(): string {
    const { from, to } = this.view.state.selection.main;
    return this.view.state.doc.sliceString(from, to);
  }

  /**
   * Prefix each line of the current selection (or current line if no
   * selection) with the given prefix. Used for blockquote, unordered list,
   * ordered list, etc. If nothing is selected, inserts prefix + placeholder.
   */
  wrapLines(prefix: string, placeholder: string): void {
    const { from, to } = this.view.state.selection.main;
    let selected = this.view.state.doc.sliceString(from, to);

    // If no selection, use the current line
    if (!selected) {
      const line = this.view.state.doc.lineAt(from);
      selected = line.text;
      // Expand selection to cover the whole line
      const newFrom = line.from;
      const newTo = line.to;
      const lines = selected ? selected.split('\n') : [placeholder];
      const prefixed = lines.map((l) => `${prefix}${l}`).join('\n');
      this.view.dispatch({
        changes: { from: newFrom, to: newTo, insert: prefixed },
        selection: { anchor: newFrom + prefix.length }
      });
    } else {
      const lines = selected.split('\n');
      const prefixed = lines.map((l) => `${prefix}${l}`).join('\n');
      this.view.dispatch({
        changes: { from, to, insert: prefixed },
        selection: { anchor: from, head: from + prefixed.length }
      });
    }
    this.view.focus();
  }

  focus(): void {
    this.view.focus();
  }

  /** Insert @ at cursor and trigger the mention dropdown. */
  insertMention(): void {
    if (!this.mention) {
      console.warn(
        "[md-editor] Mention dropdown is disabled. Pass `mention: { onMentionSearch }` in the editor options to enable it.",
      );
    }
    this.insertAtCursor("@");
  }

  /** Insert trigger char at cursor and trigger the doc-link search dropdown. */
  insertDocLink(): void {
    if (!this.docLink) {
      console.warn(
        "[md-editor] Document link dropdown is disabled. Pass `docLink: { onDocSearch }` in the editor options to enable it.",
      );
    }
    this.insertAtCursor("/");
  }

  /**
   * Toggle task list (checkbox) markers on the current line or selected
   * lines. Project convention: `- [ ]` = checked (green), `- [x]` = unchecked.
   * If all selected lines are task items: all-checked → uncheck all;
   * otherwise → check all. Plain lines or `- ` lists get `- [ ] ` prepended.
   */
  toggleTaskList(): void {
    const { from, to } = this.view.state.selection.main;
    const startLine = this.view.state.doc.lineAt(from);
    const endLine = this.view.state.doc.lineAt(to);

    const lines: string[] = [];
    for (let i = startLine.number; i <= endLine.number; i++) {
      lines.push(this.view.state.doc.line(i).text);
    }

    // Detect if all lines are already task items. Allow arbitrary whitespace
    // inside the brackets: "[ ]", "[ x]", "[x ]", "[ x ]", "[  ]".
    const taskRe = /^- \[\s*(?:[xX])?\s*\](\s|$)/;
    const checkedRe = /^- \[\s*\](\s|$)/;
    const allTask = lines.every((l) => taskRe.test(l));
    // Project convention: [ ] = checked, [x]/[X] = unchecked
    const allChecked = lines.every((l) => checkedRe.test(l));

    const processed = lines.map((line) => {
      if (allTask) {
        if (allChecked) {
          // All [ ] (checked) → convert to [x] (unchecked)
          return line.replace(/^- \[\s*\](\s?)/, "- [x]$1");
        }
        // Mixed or all [x] (unchecked) → convert to [ ] (checked)
        return line.replace(/^- \[\s*[xX]\s*\](\s?)/, "- [ ]$1");
      }
      // Convert plain list to task, or prepend task marker
      if (/^-(\s|$)/.test(line)) {
        return line.replace(/^-(\s?)/, "- [ ]$1");
      }
      return `- [ ] ${line}`;
    });

    const insertText = processed.join("\n");
    this.view.dispatch({
      changes: { from: startLine.from, to: endLine.to, insert: insertText },
      selection: { anchor: startLine.from, head: startLine.from + insertText.length }
    });
    this.view.focus();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.blurTimeout !== null) {
      window.clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
    this.mention?.destroy();
    this.docLink?.destroy();
    this.view.destroy();
  }
}

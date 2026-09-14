import { CodeEditor, type EditorTheme } from './Editor.js';
import { Renderer } from './Renderer.js';
import { Toolbar, type ToolbarAction } from './Toolbar.js';
import { StatusBar, countText } from './StatusBar.js';
import { IncrementalRenderer } from './perf/IncrementalRenderer.js';
import { debounce, adaptiveDebounceMs, type DebouncedFn } from './perf/schedule.js';
import { icons } from './icons.js';
import { Popup } from './plugins/popup.js';
import {
  extractYouTubeId,
  youTubeEmbedMarkdown,
  imageMarkdown,
  videoMarkdown
} from './plugins/media.js';
import {
  DEFAULT_SHORTCUTS,
  formatShortcutHtml,
  type ShortcutDef
} from './plugins/keyboard.js';
import type { MentionOptions } from './plugins/mention.js';
import type { DocLinkOptions } from './plugins/doclink.js';
import './styles/editor.css';

export type EditorMode = 'simple' | 'complex';
export type { EditorTheme } from './Editor.js';

/** Per-item toolbar override. */
export interface ToolbarItemOverride {
  /** Show this item. Default: true */
  show?: boolean;
  /** Custom tooltip / aria-label */
  label?: string;
  /** Custom icon as HTML string */
  icon?: string;
}

/**
 * Toolbar configuration. Either:
 * - An array of action names to show (include-list), or
 * - A record of action-name -> override for fine-grained control.
 */
export type ToolbarConfig = string[] | Record<string, ToolbarItemOverride>;

export interface MarkdownEditorOptions {
  /** Initial content */
  value?: string;
  /** 'simple': no toolbar/nav, pure edit + preview; 'complex': toolbar + status bar */
  mode?: EditorMode;
  theme?: EditorTheme;
  /** Enable math formulas. Default: true. */
  math?: boolean;
  /** Enable mindmaps. Default: true. */
  mindmap?: boolean;
  /** Enable syntax highlighting for code blocks. Default: true. */
  codeHighlight?: boolean;
  /** Enable admonition/tip blocks. Default: true. */
  tips?: boolean;
  /** Show the preview pane. Default: true. */
  preview?: boolean;
  onChange?: (value: string) => void;

  // ------- Toolbar -------
  /** Configure which toolbar items show, and their labels/icons. */
  toolbar?: ToolbarConfig;

  // ------- Image upload -------
  /**
   * Hook for image upload. Called when a user pastes, drops, or selects an
   * image file via the image popup. Return a Promise that resolves to the
   * image URL. The URL is inserted as `![alt](url)` at the cursor.
   */
  onImageUpload?: (file: File) => Promise<string>;

  // ------- @mention -------
  /**
   * @mention dropdown configuration. When provided, typing @ in the editor
   * shows a searchable dropdown. onMentionSearch returns matching items;
   * onMentionSelect returns the text to insert.
   */
  mention?: MentionOptions;

  // ------- Document link -------
  /**
   * Document/article link inserter configuration. When provided, typing /
   * in the editor shows a document search dropdown. onDocSearch returns
   * matching documents; on selection, inserts either a plain link or a
   * :::doc-link preview card with auto-fetched title/thumbnail/description.
   */
  docLink?: DocLinkOptions;

  // ------- Performance -------
  renderDebounce?: number | false;
  autoPreview?: boolean;
}

type SnippetKey =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'link'
  | 'code'
  | 'math'
  | 'mindmapBlock'
  | 'table'
  | 'hr';

const SNIPPETS: Record<SnippetKey, readonly [prefix: string, suffix: string, placeholder: string]> = {
  bold: ['**', '**', 'bold text'],
  italic: ['_', '_', 'italic text'],
  heading: ['## ', '', 'Heading'],
  link: ['[', '](https://)', 'link text'],
  code: ['```\n', '\n```', 'code'],
  math: ['$', '$', 'E=mc^2'],
  mindmapBlock: [
    '```mindmap\n# Root topic\n## Branch one\n- Child A\n- Child B\n## Branch two\n```\n',
    '',
    ''
  ],
  table: ['| Col 1 | Col 2 |\n| --- | --- |\n| ', ' | content |\n', 'content'],
  hr: ['\n---\n', '', '']
};

// All available toolbar action names in default order
const ALL_TOOLBAR_ACTIONS = [
  'heading', 'bold', 'italic', 'link', 'image', 'video', 'youtube',
  'quote', 'ul', 'ol', 'tasklist', 'mention', 'doclink', 'code', 'table', 'math', 'mindmap', 'hr',
  'tips', 'preview', 'help', 'theme'
] as const;

type ToolbarActionName = (typeof ALL_TOOLBAR_ACTIONS)[number];

export class MarkdownEditor {
  private container: HTMLElement;
  private body!: HTMLDivElement;
  private editorPane!: HTMLDivElement;
  private previewPane: HTMLDivElement | null = null;

  private codeEditor: CodeEditor;
  private renderer: Renderer;
  private incremental: IncrementalRenderer | null = null;
  private toolbar: Toolbar | null = null;
  private statusBar: StatusBar | null = null;
  private activePopup: Popup | null = null;

  private mode: EditorMode;
  private theme: EditorTheme;
  private showPreview: boolean;
  private autoPreview: boolean;
  private renderDebounceOpt: number | false | undefined;
  private onChange?: (value: string) => void;
  private onImageUpload?: (file: File) => Promise<string>;
  private toolbarConfig?: ToolbarConfig;
  private shortcuts: readonly ShortcutDef[];

  private scheduledRender: DebouncedFn<[string]> | null = null;
  private scheduledWait = 0;

  constructor(container: HTMLElement | string, options: MarkdownEditorOptions = {}) {
    const el =
      typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container;
    if (!el) throw new Error('MarkdownEditor: mount container not found');
    this.container = el;

    this.mode = options.mode ?? 'simple';
    this.theme = options.theme ?? 'light';
    this.showPreview = options.preview ?? true;
    this.autoPreview = options.autoPreview ?? true;
    this.renderDebounceOpt = options.renderDebounce;
    this.onChange = options.onChange;
    this.onImageUpload = options.onImageUpload;
    this.toolbarConfig = options.toolbar;
    this.shortcuts = DEFAULT_SHORTCUTS;

    this.container.classList.add('md-editor-root', `md-editor-mode-${this.mode}`);
    this.container.setAttribute('data-theme', this.theme);

    this.renderer = new Renderer({
      math: options.math ?? true,
      mindmap: options.mindmap ?? true,
      codeHighlight: options.codeHighlight ?? true,
      tips: options.tips ?? true
    });

    this.buildLayout();

    this.codeEditor = new CodeEditor(this.editorPane, {
      value: options.value ?? '',
      lineNumbers: this.mode === 'complex',
      theme: this.theme,
      onChange: (value) => {
        this.onChange?.(value);
        if (this.autoPreview) this.requestPreviewRender(value);
        this.updateStatusBar(value);
      },
      onImageFile: (file) => this.handleImageFile(file),
      mention: options.mention,
      docLink: options.docLink
    });

    this.setupKeyboardShortcuts();

    if (this.mode === 'complex') {
      this.buildToolbar();
      this.buildStatusBar();
    }

    if (this.previewPane) {
      this.previewPane.classList.add('markdown-body');
      this.incremental = new IncrementalRenderer(this.previewPane, (src) =>
        this.renderer.render(src)
      );
      this.setupCopyHandler();
    }

    this.renderPreview(options.value ?? '');
    this.updateStatusBar(options.value ?? '');
  }

  // ---------- Layout ----------

  private buildLayout(): void {
    this.container.innerHTML = '';

    this.body = document.createElement('div');
    this.body.className = 'md-editor-body';

    this.editorPane = document.createElement('div');
    this.editorPane.className = 'md-editor-pane md-editor-source';
    this.body.appendChild(this.editorPane);

    if (this.showPreview) {
      this.previewPane = document.createElement('div');
      this.previewPane.className = 'md-editor-pane md-editor-preview';
      this.body.appendChild(this.previewPane);
    }

    this.container.appendChild(this.body);
  }

  // ---------- Toolbar ----------

  private isActionVisible(name: string): boolean {
    if (!this.toolbarConfig) return true;
    if (Array.isArray(this.toolbarConfig)) {
      return this.toolbarConfig.includes(name);
    }
    return this.toolbarConfig[name]?.show !== false;
  }

  private getActionLabel(name: string, defaultLabel: string): string {
    if (this.toolbarConfig && !Array.isArray(this.toolbarConfig)) {
      return this.toolbarConfig[name]?.label ?? defaultLabel;
    }
    return defaultLabel;
  }

  private getActionIcon(name: string, defaultIcon: string): string {
    if (this.toolbarConfig && !Array.isArray(this.toolbarConfig)) {
      return this.toolbarConfig[name]?.icon ?? defaultIcon;
    }
    return defaultIcon;
  }

  private buildToolbar(): void {
    const actions: ToolbarAction[] = [];

    const add = (
      name: ToolbarActionName,
      defaultLabel: string,
      defaultIcon: string,
      handler: (btn: HTMLButtonElement) => void,
      opts: { toggle?: boolean; active?: boolean; groupEnd?: boolean } = {}
    ) => {
      if (!this.isActionVisible(name)) return;
      actions.push({
        name,
        title: this.getActionLabel(name, defaultLabel),
        icon: this.getActionIcon(name, defaultIcon),
        handler,
        ...opts
      });
    };

    add('heading', 'Heading', icons.heading, () => this.insertSnippet('heading'));
    add('bold', 'Bold (Ctrl+B)', icons.bold, () => this.wrapSnippet('bold'));
    add('italic', 'Italic (Ctrl+I)', icons.italic, () => this.wrapSnippet('italic'), { groupEnd: true });
    add('link', 'Link (Ctrl+K)', icons.link, () => this.wrapSnippet('link'));
    add('image', 'Insert image', icons.image, (btn) => this.showImagePopup(btn));
    add('video', 'Insert video', icons.video, (btn) => this.showVideoPopup(btn), { groupEnd: true });
    add('youtube', 'Insert YouTube video', icons.youtube, (btn) => this.showYouTubePopup(btn), { groupEnd: true });
    add('quote', 'Quote', icons.quote, () => this.codeEditor.wrapLines('> ', 'quoted text'));
    add('ul', 'Unordered list', icons.list, () => this.codeEditor.wrapLines('- ', 'list item'));
    add('ol', 'Ordered list', icons.listOrdered, () => this.codeEditor.wrapLines('1. ', 'list item'));
    add('tasklist', 'Task list', icons.taskList, () => this.codeEditor.toggleTaskList(), { groupEnd: true });
    add('mention', 'Mention (@)', icons.mention, () => this.codeEditor.insertMention());
    add('doclink', 'Insert document link', icons.fileText, () => this.codeEditor.insertDocLink());
    add('code', 'Code block', icons.code, () => this.insertSnippet('code'));
    add('table', 'Table', icons.table, (btn) => this.showTablePopup(btn), { groupEnd: true });
    add('math', 'Math formula', icons.sigma, (btn) => this.showMathPopup(btn), { groupEnd: true });
    add('mindmap', 'Insert mindmap', icons.mindmap, (btn) => this.showMindmapPopup(btn));
    add('hr', 'Horizontal rule', icons.hr, () => this.insertSnippet('hr'));
    add('tips', 'Insert callout', icons.alert, (btn) => this.showTipsPopup(btn), { groupEnd: true });
    add('preview', 'Toggle preview', icons.eye, () => this.togglePreview(), {
      toggle: true,
      active: this.showPreview
    });
    add('help', 'Keyboard shortcuts', icons.help, (btn) => this.showHelpPopup(btn));
    add('theme', 'Toggle theme', this.theme === 'dark' ? icons.sun : icons.moon, () =>
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    );

    this.toolbar = new Toolbar(actions);
    this.container.insertBefore(this.toolbar.el, this.body);
  }

  private buildStatusBar(): void {
    this.statusBar = new StatusBar({
      onRefreshPreview: () => this.renderPreview(this.codeEditor.getValue())
    });
    this.container.appendChild(this.statusBar.el);
  }

  // ---------- Keyboard shortcuts ----------

  private setupKeyboardShortcuts(): void {
    const bindings = this.shortcuts.map((s) => ({
      key: s.key,
      run: () => {
        this.executeAction(s.action);
        return true;
      }
    }));
    this.codeEditor.setKeymap(bindings);
  }

  private executeAction(action: string): void {
    switch (action) {
      case 'bold':
        this.wrapSnippet('bold');
        break;
      case 'italic':
        this.wrapSnippet('italic');
        break;
      case 'heading':
        this.insertSnippet('heading');
        break;
      case 'link':
        this.wrapSnippet('link');
        break;
      case 'code':
        this.insertSnippet('code');
        break;
      case 'quote':
        this.codeEditor.wrapLines('> ', 'quoted text');
        break;
      case 'ul':
        this.codeEditor.wrapLines('- ', 'list item');
        break;
      case 'ol':
        this.codeEditor.wrapLines('1. ', 'list item');
        break;
      case 'tasklist':
        this.codeEditor.toggleTaskList();
        break;
      case 'math':
        this.wrapSnippet('math');
        break;
      case 'preview':
        this.togglePreview();
        break;
      case 'theme':
        this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
        break;
    }
  }

  // ---------- Popup dialogs ----------

  private showImagePopup(anchor: HTMLElement): void {
    this.activePopup?.destroy();
    const hasUpload = typeof this.onImageUpload === 'function';
    this.activePopup = new Popup(anchor, {
      title: 'Insert image',
      theme: this.theme,
      fields: [
        { name: 'url', label: 'Image URL', placeholder: 'https://example.com/image.png' },
        ...(hasUpload
          ? [{ name: 'file', label: 'Or paste/drop an image into the editor', type: 'text' as const, placeholder: 'Upload via paste or drag-and-drop' }]
          : [])
      ],
      onSubmit: (values) => {
        const url = values.url ?? '';
        if (url) {
          this.codeEditor.insertAtCursor(imageMarkdown(url, 'image'));
        }
      }
    });
    this.activePopup.show();
  }

  private showVideoPopup(anchor: HTMLElement): void {
    this.activePopup?.destroy();
    this.activePopup = new Popup(anchor, {
      title: 'Insert video',
      theme: this.theme,
      fields: [
        { name: 'url', label: 'Video URL (.mp4, .webm, .ogg)', placeholder: 'https://example.com/video.mp4', required: true },
        { name: 'alt', label: 'Title', placeholder: 'video title' }
      ],
      onSubmit: (values) => {
        const url = values.url ?? '';
        if (!url) return;
        this.codeEditor.insertAtCursor(videoMarkdown(url, values.alt || 'video'));
      }
    });
    this.activePopup.show();
  }

  private showYouTubePopup(anchor: HTMLElement): void {
    this.activePopup?.destroy();
    this.activePopup = new Popup(anchor, {
      title: 'Insert YouTube video',
      theme: this.theme,
      fields: [
        {
          name: 'url',
          label: 'YouTube URL or video ID',
          placeholder: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          required: true
        }
      ],
      onSubmit: (values) => {
        const input = values.url ?? '';
        const videoId = extractYouTubeId(input);
        if (!videoId) return;
        this.codeEditor.insertAtCursor(youTubeEmbedMarkdown(videoId));
      }
    });
    this.activePopup.show();
  }

  private showTablePopup(anchor: HTMLElement): void {
    this.activePopup?.destroy();
    this.activePopup = new Popup(anchor, {
      title: 'Insert table',
      theme: this.theme,
      fields: [
        { name: 'rows', label: 'Rows', placeholder: '3' },
        { name: 'cols', label: 'Columns', placeholder: '3' }
      ],
      submitLabel: 'Insert',
      onSubmit: (values) => {
        const rows = Math.max(1, Math.min(50, parseInt(values.rows ?? '3', 10) || 3));
        const cols = Math.max(1, Math.min(20, parseInt(values.cols ?? '3', 10) || 3));
        this.codeEditor.insertAtCursor(this.generateTable(rows, cols));
      }
    });
    this.activePopup.show();
  }

  private generateTable(rows: number, cols: number): string {
    const header = '| ' + Array.from({ length: cols }, (_, i) => `Col ${i + 1}`).join(' | ') + ' |';
    const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
    const bodyRows = Math.max(0, rows - 1);
    const body = Array.from({ length: bodyRows }, () =>
      '| ' + Array.from({ length: cols }, () => 'content').join(' | ') + ' |'
    ).join('\n');
    return bodyRows > 0 ? `${header}\n${separator}\n${body}\n` : `${header}\n${separator}\n`;
  }

  private showHelpPopup(anchor: HTMLElement): void {
    this.activePopup?.destroy();
    const popup = new Popup(anchor, {
      title: 'Help',
      theme: this.theme,
      fields: [],
      onSubmit: () => {}
    });
    const body = popup.el.querySelector('.md-editor-popup-body');
    if (body) {
      const syntaxTips = [
        { label: 'Task list', hint: '- [ ] checked  /  - [x] unchecked' },
        { label: '@mention', hint: 'Type @ then pick a user from the dropdown' },
        { label: 'Document link', hint: 'Type / then pick a document' },
        { label: 'Math formula', hint: '$E=mc^2$ inline  /  $$ block $$' },
        { label: 'Mindmap', hint: '```mindmap fenced block with # headings' },
        { label: 'Callout', hint: ':::warning Title ...content... :::' },
      ];
      body.innerHTML =
        '<div class="md-editor-help-section-title">Keyboard Shortcuts</div>' +
        '<div class="md-editor-help-list">' +
        this.shortcuts
          .map(
            (s) =>
              `<div class="md-editor-help-row">
                <span class="md-editor-help-desc">${s.description}</span>
                <span class="md-editor-help-keys">${formatShortcutHtml(s.key)}</span>
              </div>`
          )
          .join('') +
        '</div>' +
        '<div class="md-editor-help-section-title">Syntax</div>' +
        '<div class="md-editor-help-list">' +
        syntaxTips
          .map(
            (t) =>
              `<div class="md-editor-help-row">
                <span class="md-editor-help-desc">${t.label}</span>
                <span class="md-editor-help-syntax">${t.hint}</span>
              </div>`
          )
          .join('') +
        '</div>';
    }
    // Replace the default button footer with a pinned brand link
    const footer = popup.el.querySelector('.md-editor-popup-footer') as HTMLElement | null;
    if (footer) {
      footer.innerHTML =
        '<span class="md-editor-help-brand-text">PowerDuck Markdown Editor</span>' +
        '<a href="https://www.powerduck.com" target="_blank" rel="noopener noreferrer" class="md-editor-help-link">powerduck.com</a>';
      footer.style.justifyContent = 'space-between';
      footer.style.alignItems = 'center';
    }

    this.activePopup = popup;
    this.activePopup.show();
  }

  // ---------- Image upload ----------

  private async handleImageFile(file: File): Promise<void> {
    if (!this.onImageUpload) return;
    try {
      const url = await this.onImageUpload(file);
      if (url) {
        this.codeEditor.insertAtCursor(imageMarkdown(url, file.name.replace(/\.[^.]+$/, '') || 'image'));
      }
    } catch {
      // Upload failed silently; user can retry via the image popup
    }
  }

  // ---------- Tips / callout dropdown ----------

  private showTipsPopup(anchor: HTMLElement): void {
    this.activePopup?.destroy();
    const types = [
      { key: 'notice', label: 'Notice', color: '#0969da' },
      { key: 'info', label: 'Info', color: '#0969da' },
      { key: 'tip', label: 'Tip', color: '#1a7f37' },
      { key: 'success', label: 'Success', color: '#1a7f37' },
      { key: 'warning', label: 'Warning', color: '#9a6700' },
      { key: 'danger', label: 'Danger', color: '#cf222e' }
    ];

    const popup = new Popup(anchor, {
      title: 'Insert callout',
      theme: this.theme,
      fields: [],
      onSubmit: () => {}
    });

    const body = popup.el.querySelector('.md-editor-popup-body');
    if (body) {
      const grid = document.createElement('div');
      grid.className = 'md-editor-tips-grid';
      for (const t of types) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'md-editor-tips-option';
        btn.innerHTML =
          `<span class="md-editor-tips-dot" style="background:${t.color}"></span>` +
          `<span>${t.label}</span>`;
        btn.addEventListener('click', () => {
          this.codeEditor.insertAtCursor(
            `:::${t.key} ${t.label}\n\nYour ${t.key.toLowerCase()} content here.\n\n:::\n`
          );
          popup.hide();
        });
        grid.appendChild(btn);
      }
      body.innerHTML = '';
      body.appendChild(grid);
    }
    const footer = popup.el.querySelector('.md-editor-popup-footer');
    if (footer) footer.remove();

    this.activePopup = popup;
    this.activePopup.show();
  }

  // ---------- Math formula template dropdown ----------

  private showMathPopup(anchor: HTMLElement): void {
    this.activePopup?.destroy();
    const templates = [
      { label: 'Inline formula', snippet: '$E=mc^2$', hint: 'Inline $...$' },
      { label: 'Block formula', snippet: '$$\nE = mc^2\n$$\n', hint: 'Block $$...$$' },
      { label: 'Fraction', snippet: '$\\frac{a}{b}$', hint: '\\frac{a}{b}' },
      { label: 'Square root', snippet: '$\\sqrt{x}$', hint: '\\sqrt{x}' },
      { label: 'Sum', snippet: '$\\sum_{i=1}^{n} i$', hint: '\\sum_{i=1}^{n}' },
      { label: 'Integral', snippet: '$\\int_{a}^{b} f(x)\\,dx$', hint: '\\int_{a}^{b}' },
      { label: 'Limit', snippet: '$\\lim_{x \\to \\infty} f(x)$', hint: '\\lim_{x \\to \\infty}' },
      { label: 'Matrix', snippet: '$$\n\\begin{pmatrix}\na & b \\\\\nc & d\n\\end{pmatrix}\n$$\n', hint: 'pmatrix 2x2' },
    ];

    const popup = new Popup(anchor, {
      title: 'Insert math formula',
      theme: this.theme,
      fields: [],
      onSubmit: () => {},
    });

    const body = popup.el.querySelector('.md-editor-popup-body');
    if (body) {
      const grid = document.createElement('div');
      grid.className = 'md-editor-template-grid';
      for (const t of templates) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'md-editor-template-option';
        btn.innerHTML =
          `<span class="md-editor-template-label">${t.label}</span>` +
          `<span class="md-editor-template-hint">${t.hint}</span>`;
        btn.addEventListener('click', () => {
          this.codeEditor.insertAtCursor(t.snippet);
          popup.hide();
        });
        grid.appendChild(btn);
      }
      body.innerHTML = '';
      body.appendChild(grid);
    }
    const footer = popup.el.querySelector('.md-editor-popup-footer');
    if (footer) footer.remove();

    this.activePopup = popup;
    this.activePopup.show();
  }

  // ---------- Mindmap template dropdown ----------

  private showMindmapPopup(anchor: HTMLElement): void {
    this.activePopup?.destroy();
    const templates = [
      {
        label: 'Simple',
        hint: 'Root with two branches',
        snippet: '```mindmap\n# Root topic\n## Branch one\n## Branch two\n```\n',
      },
      {
        label: 'Multi-level',
        hint: 'Root, branches, sub-branches',
        snippet: '```mindmap\n# Root\n## Branch one\n### Sub-branch A\n### Sub-branch B\n## Branch two\n### Sub-branch C\n```\n',
      },
      {
        label: 'With list items',
        hint: 'Branches with bullet children',
        snippet: '```mindmap\n# Root topic\n## Branch one\n- Child A\n- Child B\n## Branch two\n- Child C\n- Child D\n```\n',
      },
      {
        label: 'Org chart',
        hint: 'CEO -> Departments -> Teams',
        snippet: '```mindmap\n# CEO\n## Engineering\n### Frontend\n### Backend\n## Marketing\n### Content\n### Ads\n## Operations\n```\n',
      },
      {
        label: 'Project plan',
        hint: 'Phases with tasks',
        snippet: '```mindmap\n# Project\n## Phase 1: Design\n- Research\n- Wireframes\n## Phase 2: Build\n- Frontend\n- Backend\n## Phase 3: Launch\n- Testing\n- Deploy\n```\n',
      },
    ];

    const popup = new Popup(anchor, {
      title: 'Insert mindmap',
      theme: this.theme,
      fields: [],
      onSubmit: () => {},
    });

    const body = popup.el.querySelector('.md-editor-popup-body');
    if (body) {
      const grid = document.createElement('div');
      grid.className = 'md-editor-template-grid';
      for (const t of templates) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'md-editor-template-option';
        btn.innerHTML =
          `<span class="md-editor-template-label">${t.label}</span>` +
          `<span class="md-editor-template-hint">${t.hint}</span>`;
        btn.addEventListener('click', () => {
          this.codeEditor.insertAtCursor(t.snippet);
          popup.hide();
        });
        grid.appendChild(btn);
      }
      body.innerHTML = '';
      body.appendChild(grid);
    }
    const footer = popup.el.querySelector('.md-editor-popup-footer');
    if (footer) footer.remove();

    this.activePopup = popup;
    this.activePopup.show();
  }

  // ---------- Copy button (event delegation) ----------

  private setupCopyHandler(): void {
    if (!this.previewPane) return;
    this.previewPane.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.md-editor-codeblock-copy');
      if (!btn) return;
      const codeblock = btn.closest('.md-editor-codeblock');
      const code = codeblock?.querySelector('code');
      if (!code) return;
      const text = code.textContent ?? '';
      this.copyToClipboard(text, btn as HTMLButtonElement);
    });
  }

  private copyToClipboard(text: string, btn: HTMLButtonElement): void {
    const showCopied = () => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('is-copied');
      window.setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('is-copied');
      }, 2000);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(showCopied).catch(() => {
        this.fallbackCopy(text, showCopied);
      });
    } else {
      this.fallbackCopy(text, showCopied);
    }
  }

  private fallbackCopy(text: string, onSuccess: () => void): void {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) onSuccess();
    } catch {
      /* copy not available in this environment */
    }
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- Snippets ----------

  private insertSnippet(key: SnippetKey): void {
    const [prefix, suffix, placeholder] = SNIPPETS[key];
    this.codeEditor.insertAtCursor(`${prefix}${placeholder}${suffix}`);
  }

  private wrapSnippet(key: SnippetKey): void {
    const [prefix, suffix, placeholder] = SNIPPETS[key];
    this.codeEditor.wrapSelection(prefix, suffix, placeholder);
  }

  private togglePreview(): void {
    if (!this.previewPane) return;
    const isVisible = this.previewPane.style.display !== 'none';
    this.previewPane.style.display = isVisible ? 'none' : '';
    this.toolbar?.setActive('preview', !isVisible);
  }

  // ---------- Render scheduling (performance core) ----------

  private requestPreviewRender(value: string): void {
    const wait =
      this.renderDebounceOpt === false
        ? 0
        : this.renderDebounceOpt ?? adaptiveDebounceMs(value.length);

    if (wait === 0) {
      this.scheduledRender?.cancel();
      this.scheduledRender = null;
      this.renderPreview(value);
      return;
    }

    if (!this.scheduledRender || this.scheduledWait !== wait) {
      this.scheduledRender?.cancel();
      this.scheduledRender = debounce((v: string) => this.renderPreview(v), wait);
      this.scheduledWait = wait;
    }
    this.scheduledRender(value);
  }

  private renderPreview(value: string): void {
    if (!this.previewPane || !this.incremental) return;
    let totalCount = 0;
    try {
      const result = this.incremental.update(value);
      totalCount = result.totalCount;
    } catch {
      // Incremental render failed; fall back to a plain-text preview so the
      // user never sees a blank pane.
      this.previewPane.innerHTML = `<pre style="padding:16px;white-space:pre-wrap;word-break:break-word;">${this.escapeHtml(value)}</pre>`;
    }
    this.renderer.hydrate(this.previewPane).catch(() => {
      /* hydrate failures (e.g. markmap load error) are non-fatal */
    });
    if (this.statusBar) {
      const { charCount, wordCount } = countText(value);
      this.statusBar.update({
        charCount,
        wordCount,
        blockCount: totalCount,
        mode: this.mode,
        autoPreview: this.autoPreview
      });
    }
  }

  private updateStatusBar(value: string): void {
    if (!this.statusBar) return;
    const { charCount, wordCount } = countText(value);
    this.statusBar.update({
      charCount,
      wordCount,
      blockCount: this.incremental?.getBlockCount() ?? 0,
      mode: this.mode,
      autoPreview: this.autoPreview
    });
  }

  // ---------- Public API ----------

  getValue(): string {
    return this.codeEditor.getValue();
  }

  setValue(value: string): void {
    this.codeEditor.setValue(value);
    this.scheduledRender?.cancel();
    this.renderPreview(value);
    this.updateStatusBar(value);
  }

  getHtml(): string {
    return this.renderer.render(this.getValue());
  }

  renderNow(): void {
    this.scheduledRender?.cancel();
    this.renderPreview(this.codeEditor.getValue());
  }

  setAutoPreview(auto: boolean): void {
    this.autoPreview = auto;
    if (auto) this.renderPreview(this.codeEditor.getValue());
    this.updateStatusBar(this.codeEditor.getValue());
  }

  setMode(mode: EditorMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.container.classList.remove('md-editor-mode-simple', 'md-editor-mode-complex');
    this.container.classList.add(`md-editor-mode-${mode}`);

    this.codeEditor.setLineNumbers(mode === 'complex');

    this.toolbar?.destroy();
    this.toolbar = null;
    this.statusBar?.destroy();
    this.statusBar = null;
    this.activePopup?.destroy();
    this.activePopup = null;

    if (mode === 'complex') {
      this.buildToolbar();
      this.buildStatusBar();
      this.updateStatusBar(this.codeEditor.getValue());
    }
  }

  setTheme(theme: EditorTheme): void {
    this.theme = theme;
    this.container.setAttribute('data-theme', theme);
    this.codeEditor.setTheme(theme);
    this.toolbar?.setIcon('theme', theme === 'dark' ? icons.sun : icons.moon);
  }

  focus(): void {
    this.codeEditor.focus();
  }

  destroy(): void {
    this.scheduledRender?.cancel();
    this.scheduledRender = null;
    this.activePopup?.destroy();
    this.activePopup = null;
    this.codeEditor.destroy();
    this.toolbar?.destroy();
    this.toolbar = null;
    this.statusBar?.destroy();
    this.statusBar = null;
    this.incremental?.destroy();
    this.incremental = null;
    this.container.innerHTML = '';
    this.container.classList.remove('md-editor-root', `md-editor-mode-${this.mode}`);
    this.container.removeAttribute('data-theme');
  }
}

export { CodeEditor } from './Editor.js';
export { Renderer, renderMarkdown, type RendererOptions } from './Renderer.js';
export { Toolbar, type ToolbarAction } from './Toolbar.js';
export { StatusBar, countText } from './StatusBar.js';
export { IncrementalRenderer } from './perf/IncrementalRenderer.js';
export { splitIntoBlocks, type SourceBlock } from './perf/blocks.js';
export { debounce, adaptiveDebounceMs, scheduleIdle, cancelIdle } from './perf/schedule.js';
export { icons, type IconName } from './icons.js';
export { Popup, type PopupConfig, type PopupField } from './plugins/popup.js';
export {
  extractYouTubeId,
  youTubeEmbedMarkdown,
  imageMarkdown,
  videoMarkdown,
  isVideoFile
} from './plugins/media.js';
export {
  DEFAULT_SHORTCUTS,
  matchShortcut,
  formatShortcut,
  formatShortcutHtml,
  type ShortcutDef
} from './plugins/keyboard.js';
export { type MentionItem, type MentionOptions } from './plugins/mention.js';
export { type DocItem, type DocMeta, type DocLinkOptions } from './plugins/doclink.js';
// NOTE: The React component (MarkdownEditorReact) and its handle type are
// exported from the "./react" subpath only, to avoid forcing non-React
// consumers to install react/react-dom. Import via:
//   import { MarkdownEditorReact } from "@powerduck/md-editor/react";

import type { EditorView } from "@codemirror/view";
import type { MarkdownIt } from "markdown-it";

/**
 * A single item in the @mention dropdown.
 */
export interface MentionItem {
  /** Unique identifier */
  id: string;
  /** Display label shown in the dropdown */
  label: string;
  /** Optional avatar URL */
  avatar?: string;
  /** Optional secondary text (e.g. email, role) */
  description?: string;
  /** Allow arbitrary extra fields for consumer use */
  [key: string]: unknown;
}

/**
 * Options for the mention controller.
 */
export interface MentionOptions {
  /**
   * Hook to search for mention items based on the query text after @.
   * Return a list of items (or a Promise that resolves to one).
   * If not provided, no dropdown is shown.
   */
  onMentionSearch?: (query: string) => MentionItem[] | Promise<MentionItem[]>;
  /**
   * Hook called when an item is selected. Return the text to insert at the
   * cursor (replacing the @query). If not provided, defaults to
   * `[@label](mention:id)` so the renderer can distinguish real mentions
   * from plain @text in prose.
   */
  onMentionSelect?: (item: MentionItem) => string;
  /** Minimum query length before showing dropdown. Default: 0 (show on @). */
  minChars?: number;
  /** Maximum items shown in dropdown. Default: 8. */
  maxItems?: number;
}

interface TriggerPos {
  from: number;
  query: string;
}

/**
 * Detects @mention triggers in the editor and shows a floating dropdown.
 * Handles keyboard navigation (ArrowUp/Down, Enter, Escape) and mouse click.
 */
export class MentionController {
  private view: EditorView;
  private options: Required<MentionOptions>;
  private dropdown: HTMLDivElement | null = null;
  private items: MentionItem[] = [];
  private selectedIndex = 0;
  private trigger: TriggerPos | null = null;
  /** Snapshot of cursor position when dropdown was last shown — used by
   *  selectItem so that focus loss or selection changes cannot break the
   *  replacement range. */
  private activeHead = 0;
  private searchAbort: (() => void) | null = null;
  private destroyed = false;

  constructor(view: EditorView, options: MentionOptions = {}) {
    this.view = view;
    this.options = {
      onMentionSearch: options.onMentionSearch ?? (() => []),
      onMentionSelect:
        options.onMentionSelect ??
        ((item) => `[@${item.label}](mention:${item.id})`),
      minChars: options.minChars ?? 0,
      maxItems: options.maxItems ?? 8,
    };
  }

  /**
   * Called on every CodeMirror update. Detects @ triggers and manages
   * the dropdown visibility.
   */
  update(): void {
    if (this.destroyed) return;
    const trigger = this.findTrigger();
    if (!trigger) {
      this.hide();
      return;
    }
    this.trigger = trigger;
    void this.runSearch(trigger.query);
  }

  /** Returns true if the dropdown is currently visible. */
  isOpen(): boolean {
    return this.dropdown !== null && this.items.length > 0;
  }

  /** Select the currently highlighted item. Used by keymap-level Enter handling. */
  selectCurrent(): void {
    if (this.isOpen()) {
      this.selectItem(this.selectedIndex);
    }
  }

  /**
   * Handle keyboard events for dropdown navigation.
   * Returns true if the event was handled (and should not propagate).
   */
  handleKey(event: KeyboardEvent): boolean {
    if (!this.dropdown || this.items.length === 0) return false;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
        this.updateActiveClass();
        return true;
      case "ArrowUp":
        event.preventDefault();
        this.selectedIndex =
          (this.selectedIndex - 1 + this.items.length) % this.items.length;
        this.updateActiveClass();
        return true;
      case "Enter":
      case "Tab":
        event.preventDefault();
        this.selectItem(this.selectedIndex);
        return true;
      case "Escape":
        event.preventDefault();
        this.hide();
        return true;
    }
    return false;
  }

  private findTrigger(): TriggerPos | null {
    const { head } = this.view.state.selection.main;
    const line = this.view.state.doc.lineAt(head);
    const lineText = line.text;
    const cursorInLine = head - line.from;

    // Search backwards from cursor for an @ not preceded by a word char
    for (let i = cursorInLine - 1; i >= 0; i--) {
      const ch = lineText[i];
      if (ch === "@") {
        // Ensure @ is at start or preceded by whitespace/punctuation
        if (i === 0 || /\s|[^\w@]/.test(lineText[i - 1])) {
          const query = lineText.slice(i + 1, cursorInLine);
          // Query must not contain whitespace (ends the mention)
          if (!/\s/.test(query)) {
            return { from: line.from + i, query };
          }
          return null;
        }
        return null;
      }
      // Stop at whitespace before @
      if (/\s/.test(ch)) break;
    }
    return null;
  }

  private async runSearch(query: string): Promise<void> {
    // Cancel any in-flight search
    this.searchAbort?.();
    let cancelled = false;
    this.searchAbort = () => {
      cancelled = true;
    };

    if (query.length < this.options.minChars) {
      this.hide();
      return;
    }

    try {
      const result = await this.options.onMentionSearch(query);
      if (cancelled || this.destroyed) return;
      this.items = result.slice(0, this.options.maxItems);
      this.selectedIndex = 0;
      if (this.items.length > 0) {
        this.show();
      } else {
        this.hide();
      }
    } catch {
      if (!cancelled) this.hide();
    }
  }

  private show(): void {
    if (!this.trigger) return;
    // Snapshot cursor position so selectItem works even if the editor
    // lost focus while the user was reaching for the dropdown.
    this.activeHead = this.view.state.selection.main.head;

    if (!this.dropdown) {
      this.dropdown = document.createElement("div");
      this.dropdown.className = "md-editor-mention-dropdown";
      this.dropdown.setAttribute("role", "listbox");
      // Mount on document.body with position:fixed to avoid any ancestor
      // overflow/clipping. Copy theme from editor root for styling.
      const root = this.view.dom.closest(".md-editor-root") as HTMLElement | null;
      const theme = root?.getAttribute("data-theme") ?? "light";
      this.dropdown.setAttribute("data-theme", theme);
      document.body.appendChild(this.dropdown);

      // Event delegation: a single mousedown listener on the container.
      // This is far more robust than per-item listeners because items are
      // never recreated on hover (no detached-element click targets).
      this.dropdown.addEventListener("mousedown", (e) => {
        const target = e.target as HTMLElement;
        const itemEl = target.closest(".md-editor-mention-item") as HTMLElement | null;
        if (!itemEl) return;
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(itemEl.dataset.index);
        if (!Number.isNaN(idx)) this.selectItem(idx);
      });
      // Hover: update active class without rebuilding items.
      this.dropdown.addEventListener("mouseover", (e) => {
        const target = e.target as HTMLElement;
        const itemEl = target.closest(".md-editor-mention-item") as HTMLElement | null;
        if (!itemEl) return;
        const idx = Number(itemEl.dataset.index);
        if (!Number.isNaN(idx) && idx !== this.selectedIndex) {
          this.selectedIndex = idx;
          this.updateActiveClass();
        }
      });
    }

    this.renderDropdown();
    this.positionDropdown();
  }

  private renderDropdown(): void {
    if (!this.dropdown) return;
    this.dropdown.innerHTML = "";

    this.items.forEach((item, index) => {
      const el = document.createElement("div");
      el.className =
        "md-editor-mention-item" +
        (index === this.selectedIndex ? " is-active" : "");
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", index === this.selectedIndex ? "true" : "false");
      el.dataset.index = String(index);

      if (item.avatar) {
        const img = document.createElement("img");
        img.className = "md-editor-mention-avatar";
        img.src = item.avatar;
        img.alt = "";
        el.appendChild(img);
      }

      const textWrap = document.createElement("div");
      textWrap.className = "md-editor-mention-text";

      const label = document.createElement("div");
      label.className = "md-editor-mention-label";
      label.textContent = item.label;
      textWrap.appendChild(label);

      if (item.description) {
        const desc = document.createElement("div");
        desc.className = "md-editor-mention-desc";
        desc.textContent = item.description;
        textWrap.appendChild(desc);
      }

      el.appendChild(textWrap);
      this.dropdown!.appendChild(el);
    });
  }

  /** Update the active-item CSS class without rebuilding the DOM. */
  private updateActiveClass(): void {
    if (!this.dropdown) return;
    const children = this.dropdown.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement;
      const active = i === this.selectedIndex;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-selected", active ? "true" : "false");
    }
  }

  private positionDropdown(): void {
    if (!this.dropdown || !this.trigger) return;

    // coordsAtPos can throw in limited DOM environments (e.g. jsdom lacks
    // getClientRects). Never let positioning break the dropdown.
    let coords: { top: number; bottom: number; left: number } | null = null;
    try {
      coords = this.view.coordsAtPos(this.trigger.from);
    } catch {
      coords = null;
    }
    if (!coords) {
      // Fallback: place near the editor element.
      const rect = this.view.dom.getBoundingClientRect();
      coords = { top: rect.top, bottom: rect.top + 20, left: rect.left };
    }
    const rect = this.dropdown.getBoundingClientRect();
    const viewportH = window.innerHeight;

    let top = coords.bottom + 4;
    let left = coords.left;

    // Flip above if not enough space below
    if (top + rect.height > viewportH - 8) {
      top = coords.top - rect.height - 4;
    }
    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8));

    // position:fixed → viewport coordinates, no scroll offset
    this.dropdown.style.top = `${top}px`;
    this.dropdown.style.left = `${left}px`;
  }

  private selectItem(index: number): void {
    const item = this.items[index];
    const trigger = this.trigger;
    if (!item || !trigger) return;

    const replacement = this.options.onMentionSelect(item);
    // Warn if a custom onMentionSelect returns plain "@text" instead of the
    // [@label](mention:id) wrapper. Plain @text will NOT render as a badge
    // in the preview and will be indistinguishable from a regular @mention.
    if (
      this.options.onMentionSelect !== undefined &&
      !replacement.includes("](mention:") &&
      replacement.startsWith("@")
    ) {
      console.warn(
        "[md-editor] onMentionSelect returned plain '@" + item.label +
        "'. For badge rendering in the preview, return '[@" + item.label +
        "](mention:" + item.id + ")' instead, or omit onMentionSelect to use the default wrapper.",
      );
    }
    const from = trigger.from;
    const to = this.activeHead;

    // Focus the editor before dispatching so the change lands in the
    // correct document and the cursor is restored after insertion.
    this.view.focus();
    this.view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + replacement.length },
    });

    this.hide();
  }

  hide(): void {
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
    }
    this.items = [];
    this.trigger = null;
    this.searchAbort?.();
    this.searchAbort = null;
  }

  destroy(): void {
    this.destroyed = true;
    this.hide();
  }
}

// ---------------------------------------------------------------------------
// markdown-it plugin: render [@label](mention:id) as styled badges in preview
// ---------------------------------------------------------------------------

/**
 * Render `[@label](mention:user-id)` in the preview as a styled mention badge.
 *
 * Uses the standard markdown link syntax with a `mention:` URI scheme so that
 * plain `@text` in prose (e.g. "@media", "@deprecated", email addresses) is
 * never mistaken for a mention. Only links whose href starts with `mention:`
 * are converted to badges; all other links render normally.
 */
export function useMentionRender(md: MarkdownIt): void {
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  const defaultLinkClose =
    md.renderer.rules.link_close ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  let inMentionLink = false;

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token?.attrGet("href") ?? "";
    if (typeof href === "string" && href.startsWith("mention:")) {
      inMentionLink = true;
      const id = href.slice("mention:".length);
      return `<span class="md-editor-mention" data-mention-id="${escapeAttr(id)}">`;
    }
    inMentionLink = false;
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.link_close = (tokens, idx, options, env, self) => {
    if (inMentionLink) {
      inMentionLink = false;
      return "</span>";
    }
    return defaultLinkClose(tokens, idx, options, env, self);
  };
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

import type { MarkdownIt } from "markdown-it";
import type { EditorView } from "@codemirror/view";

/**
 * A document / article item returned by the search hook.
 */
export interface DocItem {
  /** Unique identifier */
  id: string;
  /** Document title */
  title: string;
  /** Document URL */
  url: string;
  /** Optional thumbnail URL (if known upfront) */
  thumbnail?: string;
  /** Optional description / excerpt (if known upfront) */
  description?: string;
  /** Allow arbitrary extra fields for consumer use */
  [key: string]: unknown;
}

/**
 * Fetched metadata for a document URL.
 */
export interface DocMeta {
  title?: string;
  thumbnail?: string;
  description?: string;
}

/**
 * Options for the document-link inserter.
 */
export interface DocLinkOptions {
  /**
   * Hook to search documents by query. Return a list of items (or a Promise).
   * If not provided, the slash-triggered dropdown is disabled.
   */
  onDocSearch?: (query: string) => DocItem[] | Promise<DocItem[]>;
  /**
   * Hook to fetch metadata for a URL. Override this to use a backend proxy
   * and avoid browser CORS restrictions. If not provided, a default fetch +
   * DOMParser implementation is used (may fail on cross-origin URLs).
   */
  onFetchDocMeta?: (url: string) => Promise<DocMeta>;
  /**
   * Insert style when a document is selected.
   * - 'card': always insert a :::doc-link preview card (falls back to link if no meta)
   * - 'link': always insert a plain markdown link
   * - 'auto' (default): insert card if metadata is available, link otherwise
   */
  insertStyle?: "card" | "link" | "auto";
  /** Character that triggers the document search dropdown. Default: '/' */
  triggerChar?: string;
  /** Minimum query length before searching. Default: 0 */
  minChars?: number;
  /** Maximum items shown in dropdown. Default: 8 */
  maxItems?: number;
}

interface TriggerPos {
  from: number;
  query: string;
}

// ---------------------------------------------------------------------------
// Default metadata fetcher
// ---------------------------------------------------------------------------

/**
 * Default implementation: fetch the URL and parse Open Graph / meta tags.
 * This will fail on cross-origin URLs due to CORS; consumers should override
 * with onFetchDocMeta using a backend proxy in production.
 */
export async function defaultFetchDocMeta(url: string): Promise<DocMeta> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return parseDocMeta(html, url);
}

/** Parse OG / meta tags from an HTML string. */
export function parseDocMeta(html: string, baseUrl: string): DocMeta {
  const meta: DocMeta = {};
  const doc = new DOMParser().parseFromString(html, "text/html");

  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
  const title = ogTitle ?? doc.querySelector("title")?.textContent ?? undefined;
  if (title) meta.title = title.trim();

  const ogDesc =
    doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
    doc.querySelector('meta[name="description"]')?.getAttribute("content");
  if (ogDesc) meta.description = ogDesc.trim();

  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ??
    doc.querySelector('meta[property="og:image:secure_url"]')?.getAttribute("content") ??
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
  if (ogImage) {
    meta.thumbnail = ogImage.startsWith("http")
      ? ogImage
      : new URL(ogImage, baseUrl).href;
  }

  return meta;
}

// ---------------------------------------------------------------------------
// DocLinkController: slash-triggered search dropdown
// ---------------------------------------------------------------------------

/**
 * Detects the trigger character (default '/') in the editor and shows a
 * floating document search dropdown. Handles keyboard navigation and inserts
 * either a plain link or a :::doc-link preview card on selection.
 */
export class DocLinkController {
  private view: EditorView;
  private options: Required<DocLinkOptions>;
  private dropdown: HTMLDivElement | null = null;
  private items: DocItem[] = [];
  private selectedIndex = 0;
  private trigger: TriggerPos | null = null;
  /** Snapshot of cursor position when dropdown was last shown. */
  private activeHead = 0;
  private searchAbort: (() => void) | null = null;
  private destroyed = false;

  constructor(view: EditorView, options: DocLinkOptions = {}) {
    this.view = view;
    this.options = {
      onDocSearch: options.onDocSearch ?? (() => []),
      insertStyle: options.insertStyle ?? "auto",
      triggerChar: options.triggerChar ?? "/",
      minChars: options.minChars ?? 0,
      maxItems: options.maxItems ?? 8,
      // Use the built-in fetch+DOMParser fetcher unless the consumer provides
      // their own (e.g. a backend proxy to avoid CORS).
      onFetchDocMeta: options.onFetchDocMeta ?? defaultFetchDocMeta,
    };
  }

  /** Called on every CodeMirror update. */
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
      void this.selectItem(this.selectedIndex);
    }
  }

  /** Handle keyboard events for dropdown navigation. */
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
        void this.selectItem(this.selectedIndex);
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
    const triggerChar = this.options.triggerChar;

    for (let i = cursorInLine - 1; i >= 0; i--) {
      const ch = lineText[i];
      if (ch === triggerChar) {
        // Trigger must be at line start or preceded by whitespace
        if (i === 0 || /\s/.test(lineText[i - 1])) {
          const query = lineText.slice(i + 1, cursorInLine);
          if (!/\s/.test(query)) {
            return { from: line.from + i, query };
          }
          return null;
        }
        return null;
      }
      if (/\s/.test(ch)) break;
    }
    return null;
  }

  private async runSearch(query: string): Promise<void> {
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
      const result = await this.options.onDocSearch(query);
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
    this.activeHead = this.view.state.selection.main.head;
    if (!this.dropdown) {
      this.dropdown = document.createElement("div");
      this.dropdown.className = "md-editor-doclink-dropdown";
      this.dropdown.setAttribute("role", "listbox");
      // Mount on document.body with position:fixed to avoid any ancestor
      // overflow/clipping. Copy theme from editor root for styling.
      const root = this.view.dom.closest(".md-editor-root") as HTMLElement | null;
      const theme = root?.getAttribute("data-theme") ?? "light";
      this.dropdown.setAttribute("data-theme", theme);
      document.body.appendChild(this.dropdown);

      // Event delegation — see MentionController for rationale.
      this.dropdown.addEventListener("mousedown", (e) => {
        const target = e.target as HTMLElement;
        const itemEl = target.closest(".md-editor-doclink-item") as HTMLElement | null;
        if (!itemEl) return;
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(itemEl.dataset.index);
        if (!Number.isNaN(idx)) void this.selectItem(idx);
      });
      this.dropdown.addEventListener("mouseover", (e) => {
        const target = e.target as HTMLElement;
        const itemEl = target.closest(".md-editor-doclink-item") as HTMLElement | null;
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
        "md-editor-doclink-item" +
        (index === this.selectedIndex ? " is-active" : "");
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", index === this.selectedIndex ? "true" : "false");
      el.dataset.index = String(index);

      if (item.thumbnail) {
        const img = document.createElement("img");
        img.className = "md-editor-doclink-thumb-img";
        img.src = item.thumbnail;
        img.alt = "";
        el.appendChild(img);
      }

      const textWrap = document.createElement("div");
      textWrap.className = "md-editor-doclink-text";

      const label = document.createElement("div");
      label.className = "md-editor-doclink-label";
      label.textContent = item.title;
      textWrap.appendChild(label);

      if (item.description) {
        const desc = document.createElement("div");
        desc.className = "md-editor-doclink-desc";
        desc.textContent = item.description;
        textWrap.appendChild(desc);
      }

      const urlEl = document.createElement("div");
      urlEl.className = "md-editor-doclink-url";
      try {
        urlEl.textContent = new URL(item.url).hostname;
      } catch {
        urlEl.textContent = item.url;
      }
      textWrap.appendChild(urlEl);

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
    // coordsAtPos can throw in limited DOM environments (jsdom).
    let coords: { top: number; bottom: number; left: number } | null = null;
    try {
      coords = this.view.coordsAtPos(this.trigger.from);
    } catch {
      coords = null;
    }
    if (!coords) {
      const rect = this.view.dom.getBoundingClientRect();
      coords = { top: rect.top, bottom: rect.top + 20, left: rect.left };
    }
    const rect = this.dropdown.getBoundingClientRect();
    const viewportH = window.innerHeight;

    let top = coords.bottom + 4;
    let left = coords.left;
    if (top + rect.height > viewportH - 8) {
      top = coords.top - rect.height - 4;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8));

    // position:fixed → viewport coordinates, no scroll offset
    this.dropdown.style.top = `${top}px`;
    this.dropdown.style.left = `${left}px`;
  }

  private async selectItem(index: number): Promise<void> {
    const item = this.items[index];
    const trigger = this.trigger;
    if (!item || !trigger) return;

    const triggerFrom = trigger.from;
    const head = this.activeHead;

    // Focus before dispatching so the change lands correctly.
    this.view.focus();

    // Remove the trigger text (e.g. "/query")
    this.view.dispatch({
      changes: { from: triggerFrom, to: head, insert: "" },
    });

    // Determine insertion content
    const insertText = await this.buildInsertion(item);

    this.view.dispatch({
      changes: { from: triggerFrom, insert: insertText },
      selection: { anchor: triggerFrom + insertText.length },
    });

    this.hide();
  }

  /**
   * Build the markdown insertion string for a selected document.
   * Fetches metadata if needed and falls back to a plain link.
   */
  private async buildInsertion(item: DocItem): Promise<string> {
    const style = this.options.insertStyle;

    if (style === "link") {
      return `[${item.title}](${item.url})`;
    }

    // Start with whatever metadata the item already carries
    let meta: DocMeta = {
      title: item.title,
      thumbnail: item.thumbnail,
      description: item.description,
    };

    const needsFetch = !meta.thumbnail || !meta.description;

    // Try to fetch missing metadata (built-in default or user-provided hook).
    // Failures are silent — we fall back to a plain link below.
    if (needsFetch) {
      try {
        const fetched = await this.options.onFetchDocMeta(item.url);
        meta = {
          title: fetched.title ?? meta.title,
          thumbnail: fetched.thumbnail ?? meta.thumbnail,
          description: fetched.description ?? meta.description,
        };
      } catch {
        // Fetch failed (CORS, network, etc.) — metadata stays as-is
      }
    }

    // A card needs at least a thumbnail OR a description
    const hasCardMeta = !!(meta.thumbnail || meta.description);

    // auto mode: card only if we have metadata, otherwise plain link
    if (style === "auto" && !hasCardMeta) {
      return `[${item.title}](${item.url})`;
    }

    // card mode: if still no metadata, fall back to plain link
    if (style === "card" && !hasCardMeta) {
      return `[${item.title}](${item.url})`;
    }

    // Build :::doc-link card
    const lines: string[] = [`:::doc-link ${item.url}`];
    lines.push(`# ${meta.title ?? item.title}`);
    if (meta.thumbnail) {
      lines.push(`![thumbnail](${meta.thumbnail})`);
    }
    if (meta.description) {
      lines.push(meta.description);
    }
    lines.push(":::");
    return "\n" + lines.join("\n") + "\n";
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
// markdown-it plugin: render :::doc-link blocks as preview cards
// ---------------------------------------------------------------------------

const DOC_LINK_OPEN_RE = /^:::doc-link\s+(\S+)(?:\s+(.+))?$/;
const DOC_LINK_CLOSE_RE = /^:::\s*$/;

export function useDocLinkBlock(md: MarkdownIt): void {
  md.block.ruler.before("fence", "doclink_block", (state, start, end, silent) => {
    const firstLine = state.src.slice(state.bMarks[start], state.eMarks[start]);
    const openMatch = firstLine.match(DOC_LINK_OPEN_RE);
    if (!openMatch) return false;

    const url = openMatch[1] ?? "";

    let nextLine = start + 1;
    let found = false;
    while (nextLine < end) {
      const l = state.src.slice(state.bMarks[nextLine], state.eMarks[nextLine]);
      if (DOC_LINK_CLOSE_RE.test(l.trim())) {
        found = true;
        break;
      }
      nextLine++;
    }
    if (!found) return false;
    if (silent) return true;

    // Parse content lines: # title, ![thumb](url), description
    const contentLines = state.src
      .slice(state.bMarks[start + 1], state.bMarks[nextLine])
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let title = "";
    let thumbnail = "";
    const descParts: string[] = [];

    for (const line of contentLines) {
      if (line.startsWith("# ")) {
        title = line.slice(2).trim();
      } else if (line.startsWith("![thumbnail](")) {
        const m = line.match(/^!\[thumbnail\]\((.+)\)$/);
        if (m) thumbnail = m[1] ?? "";
      } else {
        descParts.push(line);
      }
    }

    const token = state.push("doclink_block", "div", 0);
    token.content = JSON.stringify({ url, title, thumbnail, description: descParts.join(" ") });
    state.line = nextLine + 1;
    return true;
  });

  md.renderer.rules.doclink_block = (tokens, idx): string => {
    const token = tokens[idx];
    if (!token) return "";
    let data: { url: string; title: string; thumbnail: string; description: string };
    try {
      data = JSON.parse(token.content);
    } catch {
      return "";
    }

    const { url, title, thumbnail, description } = data;
    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch {
      /* keep raw url */
    }

    const thumbHtml = thumbnail
      ? `<div class="md-editor-doclink-card-thumb"><img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" /></div>`
      : "";

    // Layout: thumbnail on the left, title/description/url on the right.
    return (
      `<a class="md-editor-doclink-card" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
      thumbHtml +
      `<div class="md-editor-doclink-card-body">` +
      `<div class="md-editor-doclink-card-title">${escapeHtml(title)}</div>` +
      (description
        ? `<div class="md-editor-doclink-card-desc">${escapeHtml(description)}</div>`
        : "") +
      `<div class="md-editor-doclink-card-url">${escapeHtml(hostname)}</div>` +
      `</div>` +
      `</a>`
    );
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

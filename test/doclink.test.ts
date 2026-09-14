import { describe, expect, it, beforeEach, vi } from "vitest";
import MarkdownIt from "markdown-it";
import { Renderer } from "../src/Renderer.js";
import {
  DocLinkController,
  parseDocMeta,
  defaultFetchDocMeta,
  useDocLinkBlock,
  type DocItem,
} from "../src/plugins/doclink.js";
import { CodeEditor } from "../src/Editor.js";

const mockDocs: DocItem[] = [
  { id: "1", title: "Getting Started", url: "https://docs.example.com/start", description: "Learn the basics" },
  { id: "2", title: "API Reference", url: "https://docs.example.com/api", thumbnail: "https://docs.example.com/thumb.jpg" },
  { id: "3", title: "Changelog", url: "https://docs.example.com/changelog" },
];

describe("doc-link card rendering", () => {
  const r = new Renderer({ math: false, mindmap: false, codeHighlight: false, tips: false });

  it("renders doc-link card with title, description, and url", () => {
    const source = [
      ":::doc-link https://example.com/article",
      "# Article Title",
      "This is the article description.",
      ":::",
    ].join("\n");
    const html = r.render(source);
    expect(html).toContain("md-editor-doclink-card");
    expect(html).toContain('href="https://example.com/article"');
    expect(html).toContain("Article Title");
    expect(html).toContain("This is the article description.");
    expect(html).toContain("example.com");
  });

  it("renders doc-link card with thumbnail", () => {
    const source = [
      ":::doc-link https://example.com/post",
      "# Post Title",
      "![thumbnail](https://example.com/thumb.jpg)",
      "Post description.",
      ":::",
    ].join("\n");
    const html = r.render(source);
    expect(html).toContain("md-editor-doclink-card-thumb");
    expect(html).toContain('src="https://example.com/thumb.jpg"');
  });

  it("renders card without thumbnail when not provided", () => {
    const source = [
      ":::doc-link https://example.com/post",
      "# Just Title",
      "Just description.",
      ":::",
    ].join("\n");
    const html = r.render(source);
    expect(html).toContain("md-editor-doclink-card");
    expect(html).not.toContain("md-editor-doclink-card-thumb");
  });

  it("escapes HTML in title and description", () => {
    const source = [
      ':::doc-link https://example.com/x',
      '# <script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      ":::",
    ].join("\n");
    const html = r.render(source);
    // Tags must be escaped, not rendered as actual HTML
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img ");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("does not render unclosed doc-link block", () => {
    const source = [
      ":::doc-link https://example.com/x",
      "# Title",
    ].join("\n");
    const html = r.render(source);
    expect(html).not.toContain("md-editor-doclink-card");
  });
});

describe("parseDocMeta - OG tag extraction", () => {
  it("extracts og:title, og:description, og:image", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="My Article" />
        <meta property="og:description" content="An amazing article" />
        <meta property="og:image" content="https://img.example.com/cover.jpg" />
      </head><body></body></html>
    `;
    const meta = parseDocMeta(html, "https://example.com/article");
    expect(meta.title).toBe("My Article");
    expect(meta.description).toBe("An amazing article");
    expect(meta.thumbnail).toBe("https://img.example.com/cover.jpg");
  });

  it("falls back to <title> and meta description", () => {
    const html = `
      <html><head>
        <title>Fallback Title</title>
        <meta name="description" content="Fallback desc" />
      </head><body></body></html>
    `;
    const meta = parseDocMeta(html, "https://example.com");
    expect(meta.title).toBe("Fallback Title");
    expect(meta.description).toBe("Fallback desc");
  });

  it("resolves relative thumbnail URLs", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Test" />
        <meta property="og:image" content="/images/cover.jpg" />
      </head></html>
    `;
    const meta = parseDocMeta(html, "https://example.com/blog/post");
    expect(meta.thumbnail).toBe("https://example.com/images/cover.jpg");
  });

  it("returns empty object when no meta tags", () => {
    const meta = parseDocMeta("<html><body>Nothing</body></html>", "https://example.com");
    expect(meta.title).toBeUndefined();
    expect(meta.description).toBeUndefined();
    expect(meta.thumbnail).toBeUndefined();
  });

  it("prefers og:title over <title>", () => {
    const html = `
      <html><head>
        <title>Browser Title</title>
        <meta property="og:title" content="OG Title" />
      </head></html>
    `;
    const meta = parseDocMeta(html, "https://example.com");
    expect(meta.title).toBe("OG Title");
  });
});

describe("DocLinkController - trigger detection", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("detects / at start of line", () => {
    const editor = new CodeEditor(container, {
      value: "/",
      docLink: { onDocSearch: () => mockDocs },
    });
    editor.view.dispatch({ selection: { anchor: 1 } });
    // Should not throw
    expect(editor.getValue()).toBe("/");
    editor.destroy();
  });

  it("does not trigger when / is preceded by word char", () => {
    const editor = new CodeEditor(container, {
      value: "hello/world",
      docLink: { onDocSearch: () => mockDocs },
    });
    editor.view.dispatch({ selection: { anchor: 11 } });
    expect(editor.getValue()).toBe("hello/world");
    editor.destroy();
  });

  it("calls onDocSearch with query", async () => {
    const searchFn = vi.fn(() => mockDocs);
    const editor = new CodeEditor(container, {
      value: "/api",
      docLink: { onDocSearch: searchFn },
    });
    editor.view.dispatch({ selection: { anchor: 4 } });
    await new Promise((r) => setTimeout(r, 50));
    expect(searchFn).toHaveBeenCalledWith("api");
    editor.destroy();
  });

  it("respects minChars option", async () => {
    const searchFn = vi.fn(() => mockDocs);
    const editor = new CodeEditor(container, {
      value: "/a",
      docLink: { onDocSearch: searchFn, minChars: 2 },
    });
    editor.view.dispatch({ selection: { anchor: 2 } });
    await new Promise((r) => setTimeout(r, 50));
    expect(searchFn).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("insertDocLink inserts / at cursor", () => {
    const editor = new CodeEditor(container, { value: "Hello " });
    editor.view.dispatch({ selection: { anchor: 6 } });
    editor.insertDocLink();
    expect(editor.getValue()).toBe("Hello /");
    editor.destroy();
  });
});

describe("DocLinkController - keyboard navigation", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  function createControllerWithItems(): { controller: DocLinkController; editor: CodeEditor } {
    const editor = new CodeEditor(container, { value: "/" });
    editor.view.dispatch({ selection: { anchor: 1 } });
    const controller = new DocLinkController(editor.view, {
      onDocSearch: () => mockDocs,
    });
    (controller as unknown as { items: DocItem[] }).items = [...mockDocs];
    (controller as unknown as { selectedIndex: number }).selectedIndex = 0;
    (controller as unknown as { trigger: { from: number; query: string } | null }).trigger = { from: 0, query: "" };
    const dropdown = document.createElement("div");
    dropdown.className = "md-editor-doclink-dropdown";
    document.body.appendChild(dropdown);
    (controller as unknown as { dropdown: HTMLDivElement | null }).dropdown = dropdown;
    return { controller, editor };
  }

  it("ArrowDown moves selection down", () => {
    const { controller, editor } = createControllerWithItems();
    const handled = controller.handleKey(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(handled).toBe(true);
    expect((controller as unknown as { selectedIndex: number }).selectedIndex).toBe(1);
    controller.destroy();
    editor.destroy();
  });

  it("ArrowUp wraps to last item", () => {
    const { controller, editor } = createControllerWithItems();
    controller.handleKey(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect((controller as unknown as { selectedIndex: number }).selectedIndex).toBe(
      mockDocs.length - 1,
    );
    controller.destroy();
    editor.destroy();
  });

  it("Escape hides dropdown", () => {
    const { controller, editor } = createControllerWithItems();
    controller.handleKey(new KeyboardEvent("keydown", { key: "Escape" }));
    expect((controller as unknown as { dropdown: unknown }).dropdown).toBeNull();
    controller.destroy();
    editor.destroy();
  });

  it("handleKey returns false when no dropdown", () => {
    const controller = new DocLinkController(
      new CodeEditor(container, { value: "" }).view,
      { onDocSearch: () => mockDocs },
    );
    expect(controller.handleKey(new KeyboardEvent("keydown", { key: "ArrowDown" }))).toBe(false);
    controller.destroy();
  });
});

describe("DocLinkController - insertion styles", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  function getBuildInsertion(controller: DocLinkController) {
    const c = controller as unknown as {
      buildInsertion: (item: DocItem) => Promise<string>;
    };
    return c.buildInsertion.bind(controller);
  }

  it("insertStyle: link always produces plain link", async () => {
    const editor = new CodeEditor(container, { value: "/" });
    const controller = new DocLinkController(editor.view, {
      onDocSearch: () => mockDocs,
      insertStyle: "link",
    });
    const buildInsertion = getBuildInsertion(controller);
    const result = await buildInsertion(mockDocs[0]!);
    expect(result).toBe("[Getting Started](https://docs.example.com/start)");
    controller.destroy();
    editor.destroy();
  });

  it("insertStyle: card with full metadata produces :::doc-link block", async () => {
    const editor = new CodeEditor(container, { value: "/" });
    const controller = new DocLinkController(editor.view, {
      onDocSearch: () => mockDocs,
      insertStyle: "card",
    });
    const buildInsertion = getBuildInsertion(controller);
    const item: DocItem = {
      id: "x",
      title: "Full Doc",
      url: "https://docs.example.com/full",
      thumbnail: "https://docs.example.com/thumb.jpg",
      description: "Full description",
    };
    const result = await buildInsertion(item);
    expect(result).toContain(":::doc-link https://docs.example.com/full");
    expect(result).toContain("# Full Doc");
    expect(result).toContain("![thumbnail](https://docs.example.com/thumb.jpg)");
    expect(result).toContain("Full description");
    controller.destroy();
    editor.destroy();
  });

  it("insertStyle: card falls back to link when no metadata", async () => {
    const editor = new CodeEditor(container, { value: "/" });
    const controller = new DocLinkController(editor.view, {
      onDocSearch: () => mockDocs,
      insertStyle: "card",
    });
    const buildInsertion = getBuildInsertion(controller);
    const item: DocItem = { id: "bare", title: "Bare Doc", url: "https://docs.example.com/bare" };
    const result = await buildInsertion(item);
    expect(result).toBe("[Bare Doc](https://docs.example.com/bare)");
    controller.destroy();
    editor.destroy();
  });

  it("insertStyle: auto falls back to link when no fetcher provided", async () => {
    const editor = new CodeEditor(container, { value: "/" });
    const controller = new DocLinkController(editor.view, {
      onDocSearch: () => mockDocs,
      insertStyle: "auto",
    });
    const buildInsertion = getBuildInsertion(controller);
    const item: DocItem = { id: "bare", title: "Bare Doc", url: "https://docs.example.com/bare" };
    const result = await buildInsertion(item);
    expect(result).toBe("[Bare Doc](https://docs.example.com/bare)");
    controller.destroy();
    editor.destroy();
  });

  it("uses onFetchDocMeta to enrich item metadata", async () => {
    const editor = new CodeEditor(container, { value: "/" });
    const controller = new DocLinkController(editor.view, {
      onDocSearch: () => mockDocs,
      insertStyle: "auto",
      onFetchDocMeta: async () => ({
        title: "Fetched Title",
        thumbnail: "https://fetched.com/thumb.jpg",
        description: "Fetched description",
      }),
    });
    const buildInsertion = getBuildInsertion(controller);
    const item: DocItem = { id: "bare", title: "Original", url: "https://docs.example.com/bare" };
    const result = await buildInsertion(item);
    expect(result).toContain(":::doc-link");
    expect(result).toContain("# Fetched Title");
    expect(result).toContain("Fetched description");
    controller.destroy();
    editor.destroy();
  });

  it("falls back to plain link when fetch throws", async () => {
    const editor = new CodeEditor(container, { value: "/" });
    const controller = new DocLinkController(editor.view, {
      onDocSearch: () => mockDocs,
      insertStyle: "auto",
      onFetchDocMeta: async () => {
        throw new Error("CORS blocked");
      },
    });
    const buildInsertion = getBuildInsertion(controller);
    const item: DocItem = { id: "bare", title: "Original", url: "https://docs.example.com/bare" };
    const result = await buildInsertion(item);
    expect(result).toBe("[Original](https://docs.example.com/bare)");
    controller.destroy();
    editor.destroy();
  });
});

describe("defaultFetchDocMeta", () => {
  it("is a function", () => {
    expect(typeof defaultFetchDocMeta).toBe("function");
  });
});

describe("doclink dropdown click e2e", () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("clicking item inserts a plain link when no thumbnail/description", async () => {
    const editor = new CodeEditor(container, {
      value: "See ",
      docLink: {
        onDocSearch: async () => [{ id: "1", title: "API Docs", url: "https://docs.example.com/api" }],
        insertStyle: "auto",
      },
    });
    editor.view.dispatch({ changes: { from: 4, insert: "/" }, selection: { anchor: 5 } });
    await new Promise((r) => setTimeout(r, 50));
    const items = document.querySelectorAll(".md-editor-doclink-item");
    expect(items.length).toBe(1);
    items[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    // Wait for async selectItem (buildInsertion may await fetch)
    await new Promise((r) => setTimeout(r, 50));
    expect(editor.getValue()).toContain("[API Docs](https://docs.example.com/api)");
    editor.destroy();
  });

  it("clicking item with thumbnail inserts doc-link card", async () => {
    const editor = new CodeEditor(container, {
      value: "Read ",
      docLink: {
        onDocSearch: async () => [
          { id: "1", title: "Guide", url: "https://docs.example.com/g", description: "A guide", thumbnail: "https://img.example.com/g.png" },
        ],
        insertStyle: "auto",
        onFetchDocMeta: async () => ({ title: "Guide", description: "A guide", thumbnail: "https://img.example.com/g.png", url: "https://docs.example.com/g" }),
      },
    });
    editor.view.dispatch({ changes: { from: 5, insert: "/" }, selection: { anchor: 6 } });
    await new Promise((r) => setTimeout(r, 50));
    const items = document.querySelectorAll(".md-editor-doclink-item");
    items[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 100));
    expect(editor.getValue()).toContain(":::doc-link");
    expect(editor.getValue()).toContain("Guide");
    editor.destroy();
  });
});

describe("useDocLinkBlock - card rendering", () => {
  it("renders thumbnail before body (left image, right text)", () => {
    const md = new MarkdownIt();
    useDocLinkBlock(md);
    const src = [
      ":::doc-link https://example.com/page",
      "# My Page",
      "![thumbnail](https://img.example.com/p.png)",
      "Page description",
      ":::",
    ].join("\n");
    const html = md.render(src);
    // Thumbnail div must come before the body div in the card
    const thumbPos = html.indexOf("md-editor-doclink-card-thumb");
    const bodyPos = html.indexOf("md-editor-doclink-card-body");
    expect(thumbPos).toBeGreaterThan(-1);
    expect(bodyPos).toBeGreaterThan(-1);
    expect(thumbPos).toBeLessThan(bodyPos);
  });

  it("renders card without thumbnail gracefully", () => {
    const md = new MarkdownIt();
    useDocLinkBlock(md);
    const src = [
      ":::doc-link https://example.com/page",
      "# My Page",
      "Page description",
      ":::",
    ].join("\n");
    const html = md.render(src);
    expect(html).toContain("md-editor-doclink-card");
    expect(html).toContain("My Page");
    expect(html).toContain("Page description");
    expect(html).not.toContain("md-editor-doclink-card-thumb");
  });

  it("renders card with only title", () => {
    const md = new MarkdownIt();
    useDocLinkBlock(md);
    const src = [":::doc-link https://example.com/page", "# Only Title", ":::"].join("\n");
    const html = md.render(src);
    expect(html).toContain("Only Title");
    expect(html).toContain("example.com");
  });

  it("does not render unclosed doc-link as card", () => {
    const md = new MarkdownIt();
    useDocLinkBlock(md);
    const html = md.render(":::doc-link https://example.com/page\n# No closer");
    expect(html).not.toContain("md-editor-doclink-card");
  });

  it("escapes HTML in title and description", () => {
    const md = new MarkdownIt();
    useDocLinkBlock(md);
    const src = [
      ":::doc-link https://example.com/page",
      "# <script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      ":::",
    ].join("\n");
    const html = md.render(src);
    // Raw HTML tags must be escaped, not rendered as live elements.
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img ");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("renders hostname from URL", () => {
    const md = new MarkdownIt();
    useDocLinkBlock(md);
    const src = [":::doc-link https://docs.example.com/path?q=1", "# T", ":::"].join("\n");
    const html = md.render(src);
    expect(html).toContain("docs.example.com");
  });

  it("handles invalid URL gracefully", () => {
    const md = new MarkdownIt();
    useDocLinkBlock(md);
    const src = [":::doc-link not-a-url", "# T", ":::"].join("\n");
    const html = md.render(src);
    expect(html).toContain("md-editor-doclink-card");
    expect(html).toContain("not-a-url");
  });
});

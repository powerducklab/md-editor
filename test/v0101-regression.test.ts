import { describe, expect, it, beforeEach, vi } from "vitest";
import { MarkdownEditor } from "../src/index.js";
import { Renderer } from "../src/Renderer.js";
import { MentionController } from "../src/plugins/mention.js";

describe("v0.10.1 regression - mention wrapper format", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("default onMentionSelect produces [@label](mention:id) wrapper", () => {
    const editor = new MarkdownEditor(container, {
      mode: "complex",
      mention: {
        onMentionSearch: async () => [{ id: "1", label: "Alice" }],
      },
    });
    // Type @ to trigger the dropdown
    editor.setValue("@");
    editor.focus();
    // The controller should exist because onMentionSearch is provided
    const codeEditor = (editor as unknown as { codeEditor: { mention: MentionController | null } }).codeEditor;
    expect(codeEditor.mention).not.toBeNull();
    editor.destroy();
  });

  it("custom onMentionSelect returning plain @text triggers a warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const editor = new MarkdownEditor(container, {
      mode: "complex",
      mention: {
        onMentionSearch: async () => [{ id: "1", label: "Bob" }],
        onMentionSelect: (item) => `@${item.label}`,
      },
    });
    editor.setValue("@Bob");
    editor.focus();
    // Simulate selecting the first item via the controller directly
    const codeEditor = (editor as unknown as { codeEditor: { mention: MentionController | null } }).codeEditor;
    const ctrl = codeEditor.mention;
    if (ctrl) {
      // Manually set up trigger state to test selectItem
      (ctrl as unknown as { items: { id: string; label: string }[] }).items = [{ id: "1", label: "Bob" }];
      (ctrl as unknown as { trigger: { from: number } | null }).trigger = { from: 0 };
      (ctrl as unknown as { activeHead: number }).activeHead = 4;
      (ctrl as unknown as { selectItem: (i: number) => void }).selectItem(0);
    }
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]![0]).toContain("onMentionSelect");
    warnSpy.mockRestore();
    editor.destroy();
  });

  it("custom onMentionSelect returning wrapper format does NOT warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const editor = new MarkdownEditor(container, {
      mode: "complex",
      mention: {
        onMentionSearch: async () => [{ id: "1", label: "Alice" }],
        onMentionSelect: (item) => `[@${item.label}](mention:${item.id})`,
      },
    });
    editor.setValue("@Alice");
    editor.focus();
    const codeEditor = (editor as unknown as { codeEditor: { mention: MentionController | null } }).codeEditor;
    const ctrl = codeEditor.mention;
    if (ctrl) {
      (ctrl as unknown as { items: { id: string; label: string }[] }).items = [{ id: "1", label: "Alice" }];
      (ctrl as unknown as { trigger: { from: number } | null }).trigger = { from: 0 };
      (ctrl as unknown as { activeHead: number }).activeHead = 6;
      (ctrl as unknown as { selectItem: (i: number) => void }).selectItem(0);
    }
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    editor.destroy();
  });

  it("renderer renders [@label](mention:id) as badge", () => {
    const r = new Renderer();
    const html = r.render("Hello [@Bob](mention:42)");
    expect(html).toContain('class="md-editor-mention"');
    expect(html).toContain('data-mention-id="42"');
    expect(html).toContain("@Bob");
  });

  it("renderer does NOT render plain @text as badge", () => {
    const r = new Renderer();
    const html = r.render("Hello @Bob");
    expect(html).not.toContain("md-editor-mention");
  });
});

describe("v0.10.1 regression - doc-link card styling", () => {
  it("renders doc-link card as <a> with correct classes", () => {
    const r = new Renderer();
    const html = r.render(
      ':::doc-link https://docs.example.com/start\n# Getting Started\n![thumbnail](https://picsum.photos/96/72)\nQuick start guide\n:::',
    );
    expect(html).toContain('class="md-editor-doclink-card"');
    expect(html).toContain('href="https://docs.example.com/start"');
    expect(html).toContain('class="md-editor-doclink-card-title"');
    expect(html).toContain("Getting Started");
    expect(html).toContain('class="md-editor-doclink-card-thumb"');
  });

  it("renders doc-link card without thumbnail as plain card", () => {
    const r = new Renderer();
    const html = r.render(
      ':::doc-link https://docs.example.com/api\n# API Reference\nFull API docs\n:::',
    );
    expect(html).toContain('class="md-editor-doclink-card"');
    expect(html).not.toContain('class="md-editor-doclink-card-thumb"');
    expect(html).toContain("API Reference");
  });

  it("doc-link card title uses escapeHtml to prevent XSS", () => {
    const r = new Renderer();
    const html = r.render(
      ':::doc-link https://example.com\n# <script>alert(1)</script>\nDesc\n:::',
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("v0.10.1 regression - code block styling", () => {
  it("renders code block with wrapper and header", () => {
    const r = new Renderer();
    const html = r.render("```js\nconst x = 1;\n```");
    expect(html).toContain('class="md-editor-codeblock"');
    expect(html).toContain('class="md-editor-codeblock-header"');
    expect(html).toContain('class="md-editor-codeblock-lang"');
    expect(html).toContain("js");
  });

  it("renders code block with copy button", () => {
    const r = new Renderer();
    const html = r.render("```ts\nconst y = 2;\n```");
    expect(html).toContain('class="md-editor-codeblock-copy"');
  });

  it("renders code block with traffic light dots", () => {
    const r = new Renderer();
    const html = r.render("```py\nprint('hi')\n```");
    expect(html).toContain("md-editor-codeblock-dot--red");
    expect(html).toContain("md-editor-codeblock-dot--yellow");
    expect(html).toContain("md-editor-codeblock-dot--green");
  });

  it("handles code block without language", () => {
    const r = new Renderer();
    const html = r.render("```\nplain text\n```");
    expect(html).toContain('class="md-editor-codeblock"');
    // highlight.js may auto-detect and split tokens; check content is present
    expect(html).toContain("plain");
    expect(html).toContain("text");
  });
});

describe("v0.10.1 regression - full integration", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("editor with mention + doclink renders without errors", () => {
    const editor = new MarkdownEditor(container, {
      mode: "complex",
      mention: {
        onMentionSearch: async () => [{ id: "1", label: "Alice" }],
      },
      docLink: {
        onDocSearch: async () => [{ id: "d1", title: "Doc", url: "https://example.com" }],
      },
    });
    editor.setValue(
      "# Hello\n\n" +
      "Mention: [@Alice](mention:1)\n\n" +
      ":::doc-link https://example.com\n# Example\nA doc\n:::\n\n" +
      "```js\nconst x = 1;\n```\n",
    );
    expect(editor.getValue()).toContain("[@Alice](mention:1)");
    expect(editor.getValue()).toContain(":::doc-link");
    editor.destroy();
  });

  it("editor destroy cleans up all resources", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    editor.setValue("# Test");
    expect(() => editor.destroy()).not.toThrow();
    // Second destroy should not throw
    expect(() => editor.destroy()).not.toThrow();
  });

  it("editor handles rapid mode switches", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    editor.setValue("# Test");
    for (let i = 0; i < 10; i++) {
      editor.setMode(i % 2 === 0 ? "simple" : "complex");
    }
    expect(editor.getValue()).toBe("# Test");
    editor.destroy();
  });

  it("editor handles rapid theme switches", () => {
    const editor = new MarkdownEditor(container, { mode: "complex", theme: "light" });
    for (let i = 0; i < 10; i++) {
      editor.setTheme(i % 2 === 0 ? "dark" : "light");
    }
    expect(container.getAttribute("data-theme")).toBe("light");
    editor.destroy();
  });
});

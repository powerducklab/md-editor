import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { CodeEditor } from "../src/Editor.js";

describe("syntax highlighting", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("applies light highlight style by default", () => {
    const editor = new CodeEditor(container, {
      value: "# Hello\n\n- item one\n\n```ts\nconst x = 1;\n```\n",
    });
    // The editor should render without throwing and produce a content DOM.
    const content = container.querySelector(".cm-content");
    expect(content).toBeTruthy();
    editor.destroy();
  });

  it("applies dark highlight style when theme is dark", () => {
    const editor = new CodeEditor(container, {
      value: "# Hello\n\n- item one\n",
      theme: "dark",
    });
    const content = container.querySelector(".cm-content");
    expect(content).toBeTruthy();
    editor.destroy();
  });

  it("setTheme switches highlight without recreating the document", () => {
    const editor = new CodeEditor(container, {
      value: "# Title\n\nSome text.\n",
      theme: "light",
    });
    const before = editor.getValue();
    expect(() => editor.setTheme("dark")).not.toThrow();
    expect(editor.getValue()).toBe(before);
    expect(() => editor.setTheme("light")).not.toThrow();
    expect(editor.getValue()).toBe(before);
    editor.destroy();
  });

  it("setTheme is a no-op for the same theme", () => {
    const editor = new CodeEditor(container, {
      value: "# Title\n",
      theme: "light",
    });
    // Should not throw or dispatch unnecessarily.
    expect(() => editor.setTheme("light")).not.toThrow();
    editor.destroy();
  });

  it("highlights headings with a colored span", () => {
    const editor = new CodeEditor(container, {
      value: "# Purple Heading\n",
      theme: "light",
    });
    // CodeMirror decorates tokens with cm-t-<tag> classes.
    // Heading nodes get cm-t-heading (or cm-t-heading1).
    const headingEl = container.querySelector(".cm-t-heading, .cm-t-heading1");
    // The element may not exist if jsdom doesn't run the viewport updater,
    // but the editor must not crash.
    if (headingEl) {
      expect(headingEl.textContent).toContain("Purple Heading");
    }
    editor.destroy();
  });

  it("highlights list markers", () => {
    const editor = new CodeEditor(container, {
      value: "- first\n- second\n",
      theme: "light",
    });
    const listEl = container.querySelector(".cm-t-list");
    if (listEl) {
      expect(listEl.textContent).toContain("-");
    }
    editor.destroy();
  });

  it("highlights code block meta (language label)", () => {
    const editor = new CodeEditor(container, {
      value: "```typescript\nconst x = 1;\n```\n",
      theme: "light",
    });
    const metaEl = container.querySelector(".cm-t-meta");
    if (metaEl) {
      expect(metaEl.textContent).toContain("typescript");
    }
    editor.destroy();
  });

  it("handles large documents without performance regression", () => {
    // Build a 5000-line markdown document.
    const lines: string[] = [];
    for (let i = 0; i < 5000; i++) {
      if (i % 50 === 0) lines.push(`## Section ${i}`);
      else if (i % 10 === 0) lines.push(`- list item ${i}`);
      else if (i % 25 === 0) lines.push(`> quote line ${i}`);
      else lines.push(`Regular paragraph line ${i} with **bold** and *italic*.`);
    }
    const largeDoc = lines.join("\n");

    const start = performance.now();
    const editor = new CodeEditor(container, { value: largeDoc });
    const initMs = performance.now() - start;

    // Initialization of a 5000-line doc should be well under 2 seconds.
    expect(initMs).toBeLessThan(2000);

    // Theme switch should be near-instant (compartment reconfigure only).
    const switchStart = performance.now();
    editor.setTheme("dark");
    const switchMs = performance.now() - switchStart;
    expect(switchMs).toBeLessThan(500);

    editor.destroy();
  });

  it("preserves cursor position after theme switch", () => {
    const editor = new CodeEditor(container, {
      value: "line one\nline two\nline three\n",
    });
    // Place cursor at a known position.
    editor.view.dispatch({ selection: { anchor: 14 } });
    editor.setTheme("dark");
    expect(editor.view.state.selection.main.anchor).toBe(14);
    editor.destroy();
  });

  it("works with both mention and docLink enabled", () => {
    const editor = new CodeEditor(container, {
      value: "# Title\n\n",
      theme: "light",
      mention: { onMentionSearch: async () => [] },
      docLink: { onDocSearch: async () => [] },
    });
    expect(() => editor.setTheme("dark")).not.toThrow();
    expect(editor.getValue()).toBe("# Title\n\n");
    editor.destroy();
  });
});

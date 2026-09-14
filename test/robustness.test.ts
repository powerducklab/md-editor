import { describe, expect, it, beforeEach, vi } from "vitest";
import { MarkdownEditor } from "../src/index.js";
import { IncrementalRenderer } from "../src/perf/IncrementalRenderer.js";
import { Renderer } from "../src/Renderer.js";

describe("Robustness - error recovery", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("IncrementalRenderer falls back to plain text when renderBlock throws", () => {
    const inc = new IncrementalRenderer(container, () => {
      throw new Error("render failed");
    });
    const result = inc.update("# Hello\n\nWorld");
    expect(result.rerenderedCount).toBeGreaterThan(0);
    // Preview should not be blank — should contain escaped plain text
    expect(container.innerHTML).toContain("Hello");
    expect(container.innerHTML).toContain("World");
    inc.destroy();
  });

  it("IncrementalRenderer handles empty source", () => {
    const inc = new IncrementalRenderer(container, (s) => `<p>${s}</p>`);
    const result = inc.update("");
    // Empty source may produce one empty block; no crash is the goal
    expect(result.totalCount).toBeGreaterThanOrEqual(0);
    inc.destroy();
  });

  it("IncrementalRenderer handles very long source without crashing", () => {
    const inc = new IncrementalRenderer(container, (s) => `<p>${s.length}</p>`);
    const long = "a".repeat(100000);
    const result = inc.update(long);
    expect(result.totalCount).toBeGreaterThan(0);
    inc.destroy();
  });

  it("Renderer handles null/undefined source gracefully", () => {
    const r = new Renderer();
    expect(() => r.render(null as unknown as string)).not.toThrow();
    expect(() => r.render(undefined as unknown as string)).not.toThrow();
    // Empty string renders to empty or minimal output without crashing
    expect(typeof r.render("")).toBe("string");
  });

  it("Renderer handles malformed math without crashing", () => {
    const r = new Renderer();
    expect(() => r.render("$\\invalid{math$")).not.toThrow();
  });

  it("Renderer handles unclosed code fence", () => {
    const r = new Renderer();
    expect(() => r.render("```js\nconst x = 1;\nno closing")).not.toThrow();
  });

  it("Renderer handles unclosed doc-link block", () => {
    const r = new Renderer();
    const html = r.render(":::doc-link https://example.com\n# Title\nno closer");
    // Should not crash; unclosed block renders as plain text
    expect(html).toContain("Title");
  });

  it("MarkdownEditor survives setValue with empty string", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    expect(() => editor.setValue("")).not.toThrow();
    expect(editor.getValue()).toBe("");
    editor.destroy();
  });

  it("MarkdownEditor survives rapid setValue calls", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    for (let i = 0; i < 50; i++) {
      editor.setValue(`# Title ${i}\n\nContent ${i}`);
    }
    expect(editor.getValue()).toContain("Title 49");
    editor.destroy();
  });

  it("MarkdownEditor destroy is idempotent", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    expect(() => editor.destroy()).not.toThrow();
    expect(() => editor.destroy()).not.toThrow();
  });

  it("MarkdownEditor does not call onChange on cursor movement", () => {
    const onChange = vi.fn();
    const editor = new MarkdownEditor(container, { mode: "complex", onChange });
    onChange.mockClear();
    // Simulate selection change without doc change
    editor.focus();
    // Cursor movement should not trigger onChange
    expect(onChange).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("MarkdownEditor calls onChange only on actual content change", () => {
    const onChange = vi.fn();
    const editor = new MarkdownEditor(container, { mode: "complex", onChange });
    onChange.mockClear();
    editor.setValue("new content");
    expect(onChange).toHaveBeenCalled();
    editor.destroy();
  });
});

describe("Robustness - mention wrapper format", () => {
  it("plain @text is not rendered as mention badge", () => {
    const r = new Renderer();
    const html = r.render("Hello @Alice and @Bob");
    expect(html).not.toContain("md-editor-mention");
  });

  it("[@label](mention:id) renders as mention badge", () => {
    const r = new Renderer();
    const html = r.render("Hello [@Alice](mention:1)");
    expect(html).toContain("md-editor-mention");
    expect(html).toContain('data-mention-id="1"');
  });

  it("email addresses are not affected", () => {
    const r = new Renderer();
    const html = r.render("Contact user@example.com");
    expect(html).not.toContain("md-editor-mention");
    expect(html).toContain("user@example.com");
  });

  it("normal links are not affected", () => {
    const r = new Renderer();
    const html = r.render("[Google](https://google.com)");
    expect(html).toContain('<a href="https://google.com"');
    expect(html).not.toContain("md-editor-mention");
  });
});

import { describe, expect, it, beforeEach } from "vitest";
import { MarkdownEditor, renderMarkdown } from "../src/index.js";
import { Renderer } from "../src/Renderer.js";

describe("v0.10.3 regression - dark theme mindmap", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("renders mindmap placeholder with correct class", () => {
    const r = new Renderer();
    const html = r.render("```mindmap\n# Root\n## Branch\n```");
    expect(html).toContain('class="md-editor-mindmap"');
    expect(html).toContain("data-source=");
  });

  it("mindmap block survives nested code fences", () => {
    const r = new Renderer();
    const src = "````markdown\n```mindmap\n# Root\n## Branch\n```\n````";
    const html = r.render(src);
    // The outer ```markdown fence should render as a code block, not as a mindmap
    expect(html).toContain("md-editor-codeblock");
    expect(html).toContain("mindmap");
  });

  it("editor dark theme sets data-theme attribute", () => {
    const editor = new MarkdownEditor(container, { mode: "complex", theme: "dark" });
    expect(container.getAttribute("data-theme")).toBe("dark");
    editor.destroy();
  });

  it("editor light theme sets data-theme attribute", () => {
    const editor = new MarkdownEditor(container, { mode: "complex", theme: "light" });
    expect(container.getAttribute("data-theme")).toBe("light");
    editor.destroy();
  });
});

describe("v0.10.3 regression - help popup branding", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("help popup contains brand name", async () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    // Find the help button and click it
    const helpBtn = container.querySelector('[data-action="help"]') as HTMLElement | null;
    expect(helpBtn).not.toBeNull();
    if (helpBtn) {
      helpBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
    // Wait for popup to render
    await new Promise((r) => setTimeout(r, 50));
    const popup = document.querySelector(".md-editor-popup");
    expect(popup).not.toBeNull();
    if (popup) {
      expect(popup.textContent).toContain("PowerDuck Markdown Editor");
      expect(popup.textContent).toContain("powerduck.com");
      const link = popup.querySelector(".md-editor-help-link") as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      expect(link?.href).toContain("https://www.powerduck.com");
    }
    editor.destroy();
  });

  it("help popup contains keyboard shortcuts section", async () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const helpBtn = container.querySelector('[data-action="help"]') as HTMLElement | null;
    if (helpBtn) {
      helpBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 50));
    const popup = document.querySelector(".md-editor-popup");
    expect(popup?.textContent).toContain("Keyboard Shortcuts");
    editor.destroy();
  });

  it("help popup contains syntax section", async () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const helpBtn = container.querySelector('[data-action="help"]') as HTMLElement | null;
    if (helpBtn) {
      helpBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 50));
    const popup = document.querySelector(".md-editor-popup");
    expect(popup?.textContent).toContain("Syntax");
    expect(popup?.textContent).toContain("Task list");
    expect(popup?.textContent).toContain("@mention");
    editor.destroy();
  });
});

describe("v0.10.3 regression - final integration", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("full document with all features renders without errors", () => {
    const r = new Renderer();
    const md = [
      "# Title",
      "",
      "Paragraph with **bold** and *italic*.",
      "",
      "- [ ] checked item",
      "- [x] unchecked item",
      "",
      "Inline math: $E=mc^2$",
      "",
      "$$",
      "\\int_0^1 x^2 dx",
      "$$",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
      ":::warning Warning Title",
      "This is a warning.",
      ":::",
      "",
      "[@Alice](mention:1)",
      "",
      ":::doc-link https://example.com",
      "# Example Doc",
      "A description",
      ":::",
      "",
      "| Col1 | Col2 |",
      "|------|------|",
      "| A    | B    |",
      "",
    ].join("\n");
    expect(() => r.render(md)).not.toThrow();
    const html = r.render(md);
    expect(html).toContain("<h1");
    expect(html).toContain("md-editor-mention");
    expect(html).toContain("md-editor-codeblock");
    expect(html).toContain("md-editor-tip");
    expect(html).toContain("md-editor-doclink-card");
    expect(html).toContain("<table");
  });

  it("editor lifecycle: create, setValue, theme switch, mode switch, destroy", () => {
    const editor = new MarkdownEditor(container, { mode: "complex", theme: "light" });
    editor.setValue("# Hello\n\nWorld");
    expect(editor.getValue()).toContain("Hello");
    editor.setTheme("dark");
    expect(container.getAttribute("data-theme")).toBe("dark");
    editor.setMode("simple");
    editor.setMode("complex");
    editor.setTheme("light");
    expect(editor.getValue()).toContain("Hello");
    expect(() => editor.destroy()).not.toThrow();
  });

  it("renderMarkdown standalone function works", () => {
    const html = renderMarkdown("# Test\n\n$x^2$");
    expect(html).toContain("<h1");
    expect(html).toContain("katex");
  });
});

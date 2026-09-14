import { describe, expect, it, beforeEach } from "vitest";
import { MarkdownEditor } from "../src/index.js";

describe("Math formula template popup", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("shows 8 math templates when clicking math button", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const btn = container.querySelector("[title='Math formula']") as HTMLElement;
    expect(btn).toBeTruthy();
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    const options = document.querySelectorAll(".md-editor-template-option");
    expect(options.length).toBe(8);
    const labels = Array.from(options).map((o) => o.querySelector(".md-editor-template-label")?.textContent);
    expect(labels).toContain("Inline formula");
    expect(labels).toContain("Block formula");
    expect(labels).toContain("Fraction");
    expect(labels).toContain("Matrix");
    editor.destroy();
  });

  it("inserts inline formula when template clicked", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const btn = container.querySelector("[title='Math formula']") as HTMLElement;
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    const options = document.querySelectorAll(".md-editor-template-option");
    (options[0] as HTMLElement).click();
    expect(editor.getValue()).toContain("$E=mc^2$");
    editor.destroy();
  });

  it("inserts block formula when template clicked", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const btn = container.querySelector("[title='Math formula']") as HTMLElement;
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    const options = document.querySelectorAll(".md-editor-template-option");
    (options[1] as HTMLElement).click();
    expect(editor.getValue()).toContain("$$");
    expect(editor.getValue()).toContain("E = mc^2");
    editor.destroy();
  });

  it("inserts matrix template", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const btn = container.querySelector("[title='Math formula']") as HTMLElement;
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    const options = document.querySelectorAll(".md-editor-template-option");
    (options[7] as HTMLElement).click();
    expect(editor.getValue()).toContain("\\begin{pmatrix}");
    editor.destroy();
  });
});

describe("Mindmap template popup", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("shows 5 mindmap templates when clicking mindmap button", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const btn = container.querySelector("[title='Insert mindmap']") as HTMLElement;
    expect(btn).toBeTruthy();
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    const options = document.querySelectorAll(".md-editor-template-option");
    expect(options.length).toBe(5);
    const labels = Array.from(options).map((o) => o.querySelector(".md-editor-template-label")?.textContent);
    expect(labels).toContain("Simple");
    expect(labels).toContain("Multi-level");
    expect(labels).toContain("With list items");
    expect(labels).toContain("Org chart");
    expect(labels).toContain("Project plan");
    editor.destroy();
  });

  it("inserts simple mindmap template", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const btn = container.querySelector("[title='Insert mindmap']") as HTMLElement;
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    const options = document.querySelectorAll(".md-editor-template-option");
    (options[0] as HTMLElement).click();
    expect(editor.getValue()).toContain("```mindmap");
    expect(editor.getValue()).toContain("# Root topic");
    expect(editor.getValue()).toContain("## Branch one");
    editor.destroy();
  });

  it("inserts org chart template", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const btn = container.querySelector("[title='Insert mindmap']") as HTMLElement;
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    const options = document.querySelectorAll(".md-editor-template-option");
    (options[3] as HTMLElement).click();
    expect(editor.getValue()).toContain("# CEO");
    expect(editor.getValue()).toContain("## Engineering");
    editor.destroy();
  });

  it("closes popup after selecting a template", () => {
    const editor = new MarkdownEditor(container, { mode: "complex" });
    const btn = container.querySelector("[title='Insert mindmap']") as HTMLElement;
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll(".md-editor-template-option").length).toBe(5);
    const options = document.querySelectorAll(".md-editor-template-option");
    (options[0] as HTMLElement).click();
    // Popup should be removed after selection
    expect(document.querySelectorAll(".md-editor-popup").length).toBe(0);
    editor.destroy();
  });
});

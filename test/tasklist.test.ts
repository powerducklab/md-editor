import { describe, expect, it, beforeEach } from "vitest";
import { Renderer } from "../src/Renderer.js";
import { CodeEditor } from "../src/Editor.js";

describe("task list rendering", () => {
  const r = new Renderer({ math: false, mindmap: false, codeHighlight: false, tips: false });

  // Project convention: [ ] = checked (green), [x]/[X] = unchecked
  it("renders [ ] as checked (green) checkbox", () => {
    const html = r.render("- [ ] Buy milk");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("task-list-item");
    expect(html).toContain("Buy milk");
    expect(html).toContain("checked");
  });

  it("renders [x] as unchecked (empty) checkbox", () => {
    const html = r.render("- [x] Done task");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("task-list-item");
    expect(html).toContain("Done task");
    // [x] = unchecked, so no "checked" attribute on the input
    const inputMatch = html.match(/<input[^>]*type="checkbox"[^>]*>/);
    expect(inputMatch).toBeTruthy();
    expect(inputMatch![0]).not.toContain("checked");
  });

  it("renders uppercase [X] as unchecked", () => {
    const html = r.render("- [X] Done task");
    const inputMatch = html.match(/<input[^>]*type="checkbox"[^>]*>/);
    expect(inputMatch).toBeTruthy();
    expect(inputMatch![0]).not.toContain("checked");
  });

  it("renders mixed task list with correct checked states", () => {
    const html = r.render("- [ ] Task one\n- [x] Task two\n- [ ] Task three");
    expect(html).toContain("Task one");
    expect(html).toContain("Task two");
    expect(html).toContain("Task three");
    // [ ] = checked (2 of them), [x] = unchecked (1 of them)
    const checkboxes = html.match(/<input[^>]*type="checkbox"[^>]*>/g);
    expect(checkboxes).toHaveLength(3);
    const checkedCount = checkboxes!.filter((c) => c.includes("checked")).length;
    expect(checkedCount).toBe(2);
  });

  it("does not affect normal list items", () => {
    const html = r.render("- Normal item");
    expect(html).not.toContain("task-list-item");
    expect(html).not.toContain('type="checkbox"');
  });

  it("strips the [ ] prefix from rendered content", () => {
    const html = r.render("- [ ] Clean code");
    expect(html).not.toContain("[ ]");
    expect(html).toContain("Clean code");
  });

  it("recognizes [ x] with leading space as unchecked", () => {
    const html = r.render("- [ x] Task with space");
    const inputMatch = html.match(/<input[^>]*type="checkbox"[^>]*>/);
    expect(inputMatch).toBeTruthy();
    expect(inputMatch![0]).not.toContain("checked");
    expect(html).toContain("Task with space");
  });

  it("recognizes [x ] with trailing space as unchecked", () => {
    const html = r.render("- [x ] Task trailing space");
    const inputMatch = html.match(/<input[^>]*type="checkbox"[^>]*>/);
    expect(inputMatch).toBeTruthy();
    expect(inputMatch![0]).not.toContain("checked");
  });

  it("recognizes [ x ] with spaces both sides as unchecked", () => {
    const html = r.render("- [ x ] Task both spaces");
    const inputMatch = html.match(/<input[^>]*type="checkbox"[^>]*>/);
    expect(inputMatch).toBeTruthy();
    expect(inputMatch![0]).not.toContain("checked");
  });

  it("recognizes [  ] with multiple spaces as checked", () => {
    const html = r.render("- [  ] Task multi space");
    const inputMatch = html.match(/<input[^>]*type="checkbox"[^>]*>/);
    expect(inputMatch).toBeTruthy();
    expect(inputMatch![0]).toContain("checked");
  });
});

describe("task list toggle - CodeEditor", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("adds task marker to plain line", () => {
    const editor = new CodeEditor(container, { value: "Hello world" });
    editor.view.dispatch({ selection: { anchor: 0 } });
    editor.toggleTaskList();
    expect(editor.getValue()).toBe("- [ ] Hello world");
    editor.destroy();
  });

  it("converts plain list to task list", () => {
    const editor = new CodeEditor(container, { value: "- List item" });
    editor.view.dispatch({ selection: { anchor: 0 } });
    editor.toggleTaskList();
    expect(editor.getValue()).toBe("- [ ] List item");
    editor.destroy();
  });

  it("toggles [ ] (checked) to [x] (unchecked)", () => {
    const editor = new CodeEditor(container, { value: "- [ ] Task item" });
    editor.view.dispatch({ selection: { anchor: 0 } });
    editor.toggleTaskList();
    expect(editor.getValue()).toBe("- [x] Task item");
    editor.destroy();
  });

  it("toggles [x] (unchecked) to [ ] (checked)", () => {
    const editor = new CodeEditor(container, { value: "- [x] Done" });
    editor.view.dispatch({ selection: { anchor: 0 } });
    editor.toggleTaskList();
    expect(editor.getValue()).toBe("- [ ] Done");
    editor.destroy();
  });

  it("mixed state converts all to [ ] (checked)", () => {
    const editor = new CodeEditor(container, { value: "- [x] A\n- [ ] B\n- [ ] C" });
    editor.view.dispatch({ selection: { anchor: 0, head: editor.getValue().length } });
    editor.toggleTaskList();
    expect(editor.getValue()).toBe("- [ ] A\n- [ ] B\n- [ ] C");
    editor.destroy();
  });

  it("supports uppercase [X] (unchecked) toggling to [ ] (checked)", () => {
    const editor = new CodeEditor(container, { value: "- [X] Done" });
    editor.view.dispatch({ selection: { anchor: 0 } });
    editor.toggleTaskList();
    expect(editor.getValue()).toBe("- [ ] Done");
    editor.destroy();
  });

  it("toggles multiple plain lines", () => {
    const editor = new CodeEditor(container, { value: "Line one\nLine two\nLine three" });
    editor.view.dispatch({ selection: { anchor: 0, head: editor.getValue().length } });
    editor.toggleTaskList();
    expect(editor.getValue()).toBe("- [ ] Line one\n- [ ] Line two\n- [ ] Line three");
    editor.destroy();
  });

  it("all [ ] (checked) toggles to all [x] (unchecked)", () => {
    const editor = new CodeEditor(container, { value: "- [ ] A\n- [ ] B\n- [ ] C" });
    editor.view.dispatch({ selection: { anchor: 0, head: editor.getValue().length } });
    editor.toggleTaskList();
    expect(editor.getValue()).toBe("- [x] A\n- [x] B\n- [x] C");
    editor.destroy();
  });

  it("inserts @ mention at cursor", () => {
    const editor = new CodeEditor(container, { value: "Hello " });
    editor.view.dispatch({ selection: { anchor: 6 } });
    editor.insertMention();
    expect(editor.getValue()).toBe("Hello @");
    editor.destroy();
  });
});

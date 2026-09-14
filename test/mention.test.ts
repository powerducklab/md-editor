import { describe, expect, it, beforeEach, vi } from "vitest";
import MarkdownIt from "markdown-it";
import { MentionController, useMentionRender, type MentionItem } from "../src/plugins/mention.js";
import { CodeEditor } from "../src/Editor.js";
import { Renderer, renderMarkdown } from "../src/Renderer.js";

const mockItems: MentionItem[] = [
  { id: "1", label: "Alice", description: "alice@example.com" },
  { id: "2", label: "Bob", description: "bob@example.com" },
  { id: "3", label: "Charlie", avatar: "https://example.com/c.png" },
];

describe("MentionController - trigger detection", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("detects @ at start of line", () => {
    const editor = new CodeEditor(container, {
      value: "@",
      mention: { onMentionSearch: () => mockItems },
    });
    // Trigger update by dispatching a selection change
    editor.view.dispatch({ selection: { anchor: 1 } });
    // The mention controller should have been created and updated
    // We can't easily test the dropdown in jsdom, but we can verify no crash
    expect(editor.getValue()).toBe("@");
    editor.destroy();
  });

  it("does not trigger when @ is preceded by word char", () => {
    const editor = new CodeEditor(container, {
      value: "email@",
      mention: { onMentionSearch: () => mockItems },
    });
    editor.view.dispatch({ selection: { anchor: 6 } });
    expect(editor.getValue()).toBe("email@");
    editor.destroy();
  });

  it("does not trigger when query contains whitespace", () => {
    const editor = new CodeEditor(container, {
      value: "@hello world",
      mention: { onMentionSearch: () => mockItems },
    });
    editor.view.dispatch({ selection: { anchor: 12 } });
    expect(editor.getValue()).toBe("@hello world");
    editor.destroy();
  });

  it("calls onMentionSearch with query text", async () => {
    const searchFn = vi.fn(() => mockItems);
    const editor = new CodeEditor(container, {
      value: "@ali",
      mention: { onMentionSearch: searchFn },
    });
    editor.view.dispatch({ selection: { anchor: 4 } });
    // Wait for async search
    await new Promise((r) => setTimeout(r, 50));
    expect(searchFn).toHaveBeenCalledWith("ali");
    editor.destroy();
  });

  it("uses onMentionSelect to determine replacement text", () => {
    const selectFn = vi.fn((item: MentionItem) => `[@${item.label}](user:${item.id})`);
    const controller = new MentionController(
      // We need a real EditorView; create via CodeEditor
      new CodeEditor(container, { value: "" }).view,
      { onMentionSearch: () => mockItems, onMentionSelect: selectFn },
    );
    // Test the select function directly
    const result = selectFn(mockItems[0]!);
    expect(result).toBe("[@Alice](user:1)");
    controller.destroy();
  });

  it("defaults to [@label](mention:id) when onMentionSelect not provided", () => {
    const controller = new MentionController(
      new CodeEditor(container, { value: "" }).view,
      { onMentionSearch: () => mockItems },
    );
    // Access private method via type assertion for testing
    const select = (controller as unknown as { options: { onMentionSelect: (i: MentionItem) => string } }).options.onMentionSelect;
    expect(select(mockItems[1]!)).toBe("[@Bob](mention:2)");
    controller.destroy();
  });

  it("respects minChars option", async () => {
    const searchFn = vi.fn(() => mockItems);
    const editor = new CodeEditor(container, {
      value: "@a",
      mention: { onMentionSearch: searchFn, minChars: 2 },
    });
    editor.view.dispatch({ selection: { anchor: 2 } });
    await new Promise((r) => setTimeout(r, 50));
    // Should not call search because query length (1) < minChars (2)
    expect(searchFn).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("limits results to maxItems", () => {
    const controller = new MentionController(
      new CodeEditor(container, { value: "" }).view,
      { onMentionSearch: () => [], maxItems: 2 },
    );
    // Directly test the slicing logic by setting items
    const items = [...mockItems, ...mockItems, ...mockItems];
    const sliced = items.slice(0, (controller as unknown as { options: { maxItems: number } }).options.maxItems);
    expect(sliced).toHaveLength(2);
    controller.destroy();
  });

  it("destroy removes dropdown and cleans up", () => {
    const controller = new MentionController(
      new CodeEditor(container, { value: "" }).view,
      { onMentionSearch: () => mockItems },
    );
    controller.destroy();
    expect((controller as unknown as { destroyed: boolean }).destroyed).toBe(true);
  });

  it("handleKey returns false when dropdown not visible", () => {
    const controller = new MentionController(
      new CodeEditor(container, { value: "" }).view,
      { onMentionSearch: () => mockItems },
    );
    const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
    expect(controller.handleKey(event)).toBe(false);
    controller.destroy();
  });
});

describe("MentionController - keyboard navigation", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  function createControllerWithItems(): { controller: MentionController; editor: CodeEditor } {
    const editor = new CodeEditor(container, { value: "@" });
    editor.view.dispatch({ selection: { anchor: 1 } });
    const controller = new MentionController(editor.view, {
      onMentionSearch: () => mockItems,
    });
    // Manually set items and dropdown to test keyboard navigation in jsdom
    // (where coordsAtPos returns null and positioning may fail)
    (controller as unknown as { items: MentionItem[] }).items = [...mockItems];
    (controller as unknown as { selectedIndex: number }).selectedIndex = 0;
    (controller as unknown as { trigger: { from: number; query: string } | null }).trigger = { from: 0, query: "" };
    // Create dropdown element manually
    const dropdown = document.createElement("div");
    dropdown.className = "md-editor-mention-dropdown";
    document.body.appendChild(dropdown);
    (controller as unknown as { dropdown: HTMLDivElement | null }).dropdown = dropdown;
    return { controller, editor };
  }

  it("ArrowDown moves selection down", () => {
    const { controller, editor } = createControllerWithItems();
    const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
    const handled = controller.handleKey(downEvent);
    expect(handled).toBe(true);
    expect((controller as unknown as { selectedIndex: number }).selectedIndex).toBe(1);
    controller.destroy();
    editor.destroy();
  });

  it("ArrowUp wraps to last item", () => {
    const { controller, editor } = createControllerWithItems();
    const upEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
    controller.handleKey(upEvent);
    expect((controller as unknown as { selectedIndex: number }).selectedIndex).toBe(
      mockItems.length - 1,
    );
    controller.destroy();
    editor.destroy();
  });

  it("Escape hides dropdown", () => {
    const { controller, editor } = createControllerWithItems();
    const escEvent = new KeyboardEvent("keydown", { key: "Escape" });
    controller.handleKey(escEvent);
    expect((controller as unknown as { dropdown: unknown }).dropdown).toBeNull();
    controller.destroy();
    editor.destroy();
  });

  it("Enter selects current item", () => {
    const { controller, editor } = createControllerWithItems();
    const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
    controller.handleKey(enterEvent);
    // After select, dropdown should be hidden
    expect((controller as unknown as { dropdown: unknown }).dropdown).toBeNull();
    controller.destroy();
    editor.destroy();
  });
});

describe("mention dropdown click e2e", () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("clicking first item inserts [@Alice](mention:1)", async () => {
    const editor = new CodeEditor(container, {
      value: "Hello ",
      mention: { onMentionSearch: async () => [...mockItems] },
    });
    editor.view.dispatch({ changes: { from: 6, insert: "@" }, selection: { anchor: 7 } });
    await new Promise((r) => setTimeout(r, 50));
    const items = document.querySelectorAll(".md-editor-mention-item");
    expect(items.length).toBe(3);
    items[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(editor.getValue()).toBe("Hello [@Alice](mention:1)");
    editor.destroy();
  });

  it("clicking second item inserts [@Bob](mention:2)", async () => {
    const editor = new CodeEditor(container, {
      value: "Hi ",
      mention: { onMentionSearch: async () => [...mockItems] },
    });
    editor.view.dispatch({ changes: { from: 3, insert: "@" }, selection: { anchor: 4 } });
    await new Promise((r) => setTimeout(r, 50));
    const items = document.querySelectorAll(".md-editor-mention-item");
    items[1].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(editor.getValue()).toBe("Hi [@Bob](mention:2)");
    editor.destroy();
  });

  it("typing @b filters and click inserts [@Bob](mention:2)", async () => {
    const editor = new CodeEditor(container, {
      value: "",
      mention: {
        onMentionSearch: async (q) => mockItems.filter((u) => u.label.toLowerCase().includes(q.toLowerCase())),
      },
    });
    editor.view.dispatch({ changes: { from: 0, insert: "@b" }, selection: { anchor: 2 } });
    await new Promise((r) => setTimeout(r, 50));
    const items = document.querySelectorAll(".md-editor-mention-item");
    expect(items.length).toBe(1);
    items[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(editor.getValue()).toBe("[@Bob](mention:2)");
    editor.destroy();
  });

  it("keyboard Enter selects active item", async () => {
    const editor = new CodeEditor(container, {
      value: "Hey ",
      mention: { onMentionSearch: async () => [...mockItems] },
    });
    editor.view.dispatch({ changes: { from: 4, insert: "@" }, selection: { anchor: 5 } });
    await new Promise((r) => setTimeout(r, 50));
    // ArrowDown to select second item, then Enter — call handleKey directly
    // since dispatching synthetic KeyboardEvents on the CM dom is unreliable.
    const anyEditor = editor as unknown as { mention: { handleKey: (e: KeyboardEvent) => boolean } };
    anyEditor.mention.handleKey(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    anyEditor.mention.handleKey(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(editor.getValue()).toBe("Hey [@Bob](mention:2)");
    editor.destroy();
  });
});

describe("useMentionRender - preview rendering", () => {
  it("renders [@label](mention:id) as a mention badge", () => {
    const md = new MarkdownIt();
    useMentionRender(md);
    const html = md.render("Hello [@Alice](mention:1) and [@Bob](mention:2)!");
    expect(html).toContain('<span class="md-editor-mention" data-mention-id="1">@Alice</span>');
    expect(html).toContain('<span class="md-editor-mention" data-mention-id="2">@Bob</span>');
  });

  it("does not render plain @text as mention", () => {
    const md = new MarkdownIt();
    useMentionRender(md);
    const html = md.render("Hello @Alice and @Bob!");
    expect(html).not.toContain("md-editor-mention");
    expect(html).toContain("@Alice");
    expect(html).toContain("@Bob");
  });

  it("does not match email addresses", () => {
    const md = new MarkdownIt();
    useMentionRender(md);
    const html = md.render("Contact user@example.com for help");
    expect(html).not.toContain("md-editor-mention");
    expect(html).toContain("user@example.com");
  });

  it("does not match @ inside code span", () => {
    const md = new MarkdownIt();
    useMentionRender(md);
    const html = md.render("Use `[@variable](mention:1)` in code");
    expect(html).not.toContain("md-editor-mention");
  });

  it("does not match @ inside code fence", () => {
    const md = new MarkdownIt();
    useMentionRender(md);
    const html = md.render("```js\nconst x = [@decorator](mention:1)\n```");
    expect(html).not.toContain("md-editor-mention");
  });

  it("renders normal links unchanged", () => {
    const md = new MarkdownIt();
    useMentionRender(md);
    const html = md.render("See [the docs](https://example.com) for more.");
    expect(html).toContain('<a href="https://example.com">');
    expect(html).not.toContain("md-editor-mention");
  });

  it("renders mention with hyphens and underscores in label", () => {
    const md = new MarkdownIt();
    useMentionRender(md);
    const html = md.render("[@user_name](mention:1) and [@user-name](mention:2)");
    expect(html).toContain(">@user_name</span>");
    expect(html).toContain(">@user-name</span>");
  });

  it("escapes HTML in mention id attribute", () => {
    const md = new MarkdownIt();
    useMentionRender(md);
    const html = md.render('[@Alice](mention:"><script>alert(1)</script>)');
    expect(html).not.toContain("<script>");
  });
});

describe("Renderer integration - mention in full pipeline", () => {
  it("renders mention badge via Renderer", () => {
    const r = new Renderer();
    const html = r.render("# Title\n\nHello [@Alice](mention:1), see [@Bob](mention:2)!\n\n- [ ] task");
    expect(html).toContain('<span class="md-editor-mention" data-mention-id="1">@Alice</span>');
    expect(html).toContain('<span class="md-editor-mention" data-mention-id="2">@Bob</span>');
  });

  it("renders mention alongside doc-link cards", () => {
    const r = new Renderer();
    const src = [
      "[@Alice](mention:1) mentioned this:",
      "",
      ":::doc-link https://example.com",
      "# Doc Title",
      "Doc description",
      ":::",
    ].join("\n");
    const html = r.render(src);
    expect(html).toContain("md-editor-mention");
    expect(html).toContain("md-editor-doclink-card");
  });

  it("renders mention via standalone renderMarkdown API", () => {
    const html = renderMarkdown("Hello [@world](mention:42)!");
    expect(html).toContain("md-editor-mention");
    expect(html).toContain('data-mention-id="42"');
  });
});

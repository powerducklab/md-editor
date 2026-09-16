# @powerduck/md-editor

[![npm version](https://img.shields.io/npm/v/@powerduck/md-editor)](https://www.npmjs.com/package/@powerduck/md-editor)
[![license](https://img.shields.io/npm/l/@powerduck/md-editor)](https://github.com/powerducklab/md-editor/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/@powerduck/md-editor)](https://www.npmjs.com/package/@powerduck/md-editor)

High-performance embeddable Markdown editor with syntax highlighting, math formulas, mindmaps, @mentions, document link cards, and incremental rendering. Built on CodeMirror 6 with a React wrapper.

---

Powerduck is an open-source developer tooling platform for teams building modern API workflows.

- **CodeMirror 6 Core** — Incremental rendering, virtual scrolling, and 60fps editing for large documents
- **KaTeX Math** — Render LaTeX math formulas inline and in display blocks
- **Markmap Mindmaps** — Visualize markdown outlines as interactive mindmaps
- **highlight.js Code Blocks** — Syntax highlighting for 190+ programming languages
- **@mentions** — Type `@` to search and mention users with avatars and descriptions
- **Document Link Cards** — Type `/` to insert rich doc-link preview cards with thumbnails
- **Admonition Blocks** — `:::tip`, `:::warning`, `:::note`, and more
- **Simple & Complex Modes** — Lightweight mode for comments, full-featured mode for docs
- **Light & Dark Themes** — Built-in themes with CSS variable customization

---

## Quick Start

### Install

```bash
npm install @powerduck/md-editor
```

### React Component

```tsx
import { useRef, useState } from "react";
import {
  MarkdownEditorReact,
  type MarkdownEditorHandle,
} from "@powerduck/md-editor/react";
import "@powerduck/md-editor/dist/style.css";

function App() {
  const [value, setValue] = useState("# Hello\n\nStart typing...");
  const editorRef = useRef<MarkdownEditorHandle>(null);

  return (
    <div style={{ height: "600px" }}>
      <MarkdownEditorReact
        ref={editorRef}
        value={value}
        onChange={setValue}
        mode="complex"
        theme="light"
      />
      <button onClick={() => console.log(editorRef.current?.getHtml())}>
        Get HTML
      </button>
    </div>
  );
}
```

### Vanilla JS

```typescript
import { MarkdownEditor } from "@powerduck/md-editor";
import "@powerduck/md-editor/dist/style.css";

const editor = new MarkdownEditor("#editor", {
  value: "# Hello\n\nStart typing...",
  mode: "complex",
  theme: "light",
  onChange: (value) => console.log(value.length, "chars"),
});

const html = editor.getHtml();
```

---

## Links

- [Official Website](https://www.powerduck.com/opensource/md-editor.html)
- [Documentation](https://www.powerduck.com/docs/md-editor/introduction)
- [Live Demo](https://www.powerduck.com/demo/md-editor)
- [GitHub](https://github.com/powerducklab/md-editor)
- [npm](https://www.npmjs.com/package/@powerduck/md-editor)

---

## Features

- **CodeMirror 6 core** — incremental rendering, virtual scrolling, and 60fps editing for large documents
- **KaTeX math** — render LaTeX math formulas inline and in display blocks
- **Markmap mindmaps** — visualize markdown outlines as interactive mindmaps
- **highlight.js code blocks** — syntax highlighting for 190+ programming languages
- **@mentions** — type `@` to search and mention users with avatars and descriptions
- **Document link cards** — type `/` to insert rich doc-link preview cards with thumbnails
- **Admonition blocks** — `:::tip`, `:::warning`, `:::note`, and more
- **Simple & complex modes** — lightweight mode for comments, full-featured mode for docs
- **Light & dark themes** — built-in themes with CSS variable customization
- **Image upload hooks** — custom upload handlers with paste and drag-and-drop support
- **Toolbar & slash commands** — rich formatting toolbar and `/` command palette
- **Dual ESM/CJS builds** — works with `import` and `require`, with bundled TypeScript declarations

---

## @mention Integration

```typescript
import { MarkdownEditor, type MentionItem } from "@powerduck/md-editor";

const USERS: MentionItem[] = [
  {
    id: "1",
    label: "Alice",
    avatar: "https://example.com/a.png",
    description: "alice@example.com",
  },
  { id: "2", label: "Bob", description: "bob@example.com" },
];

new MarkdownEditor("#editor", {
  mode: "complex",
  mention: {
    onMentionSearch: async (query) =>
      USERS.filter((u) => u.label.toLowerCase().includes(query.toLowerCase())),
    onMentionSelect: (item) => `[@${item.label}](mention:${item.id})`,
    minChars: 0,
    maxItems: 8,
  },
});
```

---

## Document Link Card

```typescript
import { MarkdownEditor, type DocItem } from "@powerduck/md-editor";

const DOCS: DocItem[] = [
  {
    id: "1",
    title: "Getting Started",
    url: "https://docs.example.com/getting-started",
    thumbnail: "https://example.com/thumb.jpg",
    description: "Quick start tutorial",
  },
];

new MarkdownEditor("#editor", {
  mode: "complex",
  docLink: {
    onDocSearch: async (query) =>
      DOCS.filter((d) => d.title.toLowerCase().includes(query.toLowerCase())),
    insertStyle: "card",
    minChars: 0,
    maxItems: 6,
  },
});
```

---

## API Reference

### React Props

| Prop             | Type                      | Default     | Description                             |
| ---------------- | ------------------------- | ----------- | --------------------------------------- |
| `value`          | `string`                  | -           | Markdown content (controlled)           |
| `defaultValue`   | `string`                  | -           | Initial markdown content (uncontrolled) |
| `onChange`       | `(value: string) => void` | -           | Content change callback                 |
| `mode`           | `"simple" \| "complex"`   | `"complex"` | Editor mode                             |
| `theme`          | `"light" \| "dark"`       | `"light"`   | Color theme                             |
| `math`           | `boolean`                 | `true`      | Enable KaTeX math rendering             |
| `mindmap`        | `boolean`                 | `true`      | Enable Markmap mindmaps                 |
| `codeHighlight`  | `boolean`                 | `true`      | Enable highlight.js code blocks         |
| `tips`           | `boolean`                 | `true`      | Enable admonition blocks                |
| `preview`        | `boolean`                 | `true`      | Show preview pane                       |
| `autoPreview`    | `boolean`                 | `true`      | Auto-update preview                     |
| `renderDebounce` | `number`                  | `200`       | Preview render debounce in ms           |
| `mention`        | `MentionOptions`           | -           | @mention configuration                  |
| `docLink`        | `DocLinkOptions`           | -           | Document link card configuration        |

### Imperative Handle (React)

```typescript
interface MarkdownEditorHandle {
  getValue(): string;
  setValue(value: string): void;
  getHtml(): string;
  focus(): void;
  blur(): void;
  clear(): void;
}
```

### MentionOptions

```typescript
interface MentionOptions {
  onMentionSearch: (query: string) => MentionItem[] | Promise<MentionItem[]>;
  onMentionSelect?: (item: MentionItem) => string;
  minChars?: number;
  maxItems?: number;
  triggerChar?: string;
}
```

### DocLinkOptions

```typescript
interface DocLinkOptions {
  onDocSearch: (query: string) => DocItem[] | Promise<DocItem[]>;
  onFetchDocMeta?: (url: string) => Promise<DocMeta>;
  insertStyle?: "card" | "link" | "auto";
  minChars?: number;
  maxItems?: number;
  triggerChar?: string;
}
```

---

## TypeScript Types

```typescript
import type {
  MentionItem,
  DocItem,
  DocMeta,
  MentionOptions,
  DocLinkOptions,
} from "@powerduck/md-editor";
import type {
  MarkdownEditorHandle,
  MarkdownEditorProps,
} from "@powerduck/md-editor/react";
```

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## License

MIT © [POWERDUCK LIMITED](https://www.powerduck.com)

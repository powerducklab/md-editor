import type { MarkdownIt } from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

/**
 * Lightweight task list (checkbox) support for markdown-it.
 * Converts `- [ ]` and `- [x]` list items into checkboxes.
 * Semantics (per project convention):
 *   `- [ ]`  → checked (green checkmark)
 *   `- [x]`  → unchecked (empty box)
 * This is the inverse of GitHub Flavored Markdown; the project treats an
 * empty box as "selected/done" and a marked box as "not yet selected".
 */
export function useTaskList(md: MarkdownIt): void {
  const defaultListItem = md.renderer.rules.list_item_open;

  md.renderer.rules.list_item_open = (
    tokens: Token[],
    idx: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any,
    env: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    self: any,
  ): string => {
    const token = tokens[idx];
    if (!token) {
      return defaultListItem
        ? defaultListItem(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    }

    // Find the inline token within this list item. Structure is:
    // list_item_open -> paragraph_open -> inline -> paragraph_close -> list_item_close
    let inline: Token | undefined;
    for (let i = idx + 1; i < tokens.length && i < idx + 6; i++) {
      if (tokens[i]?.type === "inline") {
        inline = tokens[i];
        break;
      }
      if (tokens[i]?.type === "list_item_close") break;
    }

    if (inline && inline.content) {
      const content = inline.content;
      // Project convention: [ ] = checked (green), [x]/[X] = unchecked.
      // Allow arbitrary whitespace inside the brackets, e.g. "[ x]", "[x ]",
      // "[ x ]", "[  ]".
      const isChecked = /^\[\s*\]\s/.test(content);
      const isUnchecked = /^\[\s*[xX]\s*\]\s/.test(content);

      if (isChecked || isUnchecked) {
        // Strip the [ ] or [x] prefix (with optional internal whitespace)
        const stripRe = /^\[\s*(?:[xX])?\s*\]\s/;
        inline.content = content.replace(stripRe, "");
        // Also update the first text child
        if (inline.children && inline.children.length > 0) {
          const firstChild = inline.children[0];
          if (firstChild && firstChild.type === "text") {
            firstChild.content = firstChild.content.replace(stripRe, "");
          }
        }

        token.attrSet("class", "task-list-item");
        // [ ] renders checked (green); [x] renders unchecked (empty)
        const checkbox = `<input type="checkbox" disabled${isChecked ? " checked" : ""} /> `;
        const rendered = defaultListItem
          ? defaultListItem(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
        return rendered + checkbox;
      }
    }

    return defaultListItem
      ? defaultListItem(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };
}

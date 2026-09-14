import type { MarkdownIt } from "markdown-it";

/**
 * Admonition / callout blocks for tips, warnings, notes, etc.
 *
 * Syntax:
 *   :::notice
 *   This is a notice.
 *   :::
 *
 *   :::warning Title here
 *   Warning content.
 *   :::
 *
 * Supported types: notice, info, tip, warning, danger, success
 */

const TIP_TYPES = new Set([
  "notice",
  "info",
  "tip",
  "warning",
  "danger",
  "success",
]);
const TIP_OPEN_RE = /^:::(\w+)(?:\s+(.+))?$/;
const TIP_CLOSE_RE = /^:::\s*$/;

const TIP_LABELS: Record<string, string> = {
  notice: "Notice",
  info: "Info",
  tip: "Tip",
  warning: "Warning",
  danger: "Danger",
  success: "Success",
};

const TIP_ICONS: Record<string, string> = {
  notice: "i",
  info: "i",
  tip: "✓",
  warning: "!",
  danger: "✕",
  success: "✓",
};

export function useTips(md: MarkdownIt): void {
  md.block.ruler.before("fence", "tips_block", (state, start, end, silent) => {
    const firstLine = state.src.slice(state.bMarks[start], state.eMarks[start]);
    const openMatch = firstLine.match(TIP_OPEN_RE);
    if (!openMatch) return false;

    const type = (openMatch[1] ?? "").toLowerCase();
    if (!TIP_TYPES.has(type)) return false;

    // Find closing :::
    let nextLine = start + 1;
    let found = false;
    while (nextLine < end) {
      const l = state.src.slice(state.bMarks[nextLine], state.eMarks[nextLine]);
      if (TIP_CLOSE_RE.test(l.trim())) {
        found = true;
        break;
      }
      nextLine++;
    }
    if (!found) return false;
    if (silent) return true;

    const title = openMatch[2] ?? TIP_LABELS[type] ?? type;
    // Content is from line after opening to the closing line (exclusive).
    // Using bMarks[nextLine] excludes the closing ::: from the body.
    const content = state.src
      .slice(state.bMarks[start + 1], state.bMarks[nextLine])
      .trim();

    // Render inner content as markdown
    const innerHtml = md.render(content);

    const token = state.push("tips_block", "div", 0);
    token.content = innerHtml;
    token.info = type;
    token.markup = title;
    state.line = nextLine + 1;
    return true;
  });

  md.renderer.rules.tips_block = (tokens, idx): string => {
    const token = tokens[idx];
    if (!token) return "";
    const type = token.info ?? "notice";
    const title = token.markup ?? TIP_LABELS[type] ?? "Notice";
    const icon = TIP_ICONS[type] ?? "i";
    const content = token.content ?? "";

    return (
      `<div class="md-editor-tip md-editor-tip--${type}">` +
      `<div class="md-editor-tip-header">` +
      `<span class="md-editor-tip-icon">${icon}</span>` +
      `<span class="md-editor-tip-title">${escapeHtml(title)}</span>` +
      `</div>` +
      `<div class="md-editor-tip-body">${content}</div>` +
      `</div>`
    );
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import type { MarkdownIt } from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("svg", xml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("java", java);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c++", cpp);

// Languages that should NOT be wrapped in the code-block UI (handled by other plugins)
const DEFAULT_RESERVED = new Set(["mindmap"]);

export interface CodeHighlightOptions {
  /** Languages to skip (delegate to the previously-registered renderer). Default: ['mindmap']. */
  reservedLanguages?: readonly string[];
}

type FenceRenderer = (
  tokens: Token[],
  idx: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
  env: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  self: any,
) => string;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Highlight code fences with highlight.js and wrap them in a macOS-style
 * container with traffic-light dots, a language label, and a copy button.
 *
 * The copy button works via event delegation on the preview container
 * (see MarkdownEditor.setupCopyHandler), so no per-button listeners are needed.
 *
 * Mindmap fences are delegated to the previously-registered renderer.
 */
export function useCodeHighlight(
  md: MarkdownIt,
  options: CodeHighlightOptions = {},
): void {
  const reserved = new Set(options.reservedLanguages ?? DEFAULT_RESERVED);

  const defaultFence: FenceRenderer = md.renderer.rules.fence
    ? (md.renderer.rules.fence as FenceRenderer).bind(md.renderer.rules)
    : (tokens, idx, options, _env, self) =>
        self.renderToken(tokens, idx, options);

  md.renderer.rules.fence = (tokens, idx, options, env, self): string => {
    const token = tokens[idx];
    if (!token) return defaultFence(tokens, idx, options, env, self);

    const info = token.info.trim();
    const lang = info.split(/\s+/)[0]?.toLowerCase() ?? "";

    // Delegate reserved languages (e.g. mindmap) to the previous renderer
    if (reserved.has(lang)) {
      return defaultFence(tokens, idx, options, env, self);
    }

    const code = token.content;
    let highlighted: string;
    let detectedLang = lang || "text";

    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(code, {
          language: lang,
          ignoreIllegals: true,
        }).value;
      } catch {
        highlighted = escapeHtml(code);
      }
    } else if (lang) {
      // Unknown language: try auto-detection
      try {
        const result = hljs.highlightAuto(code);
        highlighted = result.value;
        detectedLang = result.language || lang;
      } catch {
        highlighted = escapeHtml(code);
      }
    } else {
      // No language specified: try auto-detection, fall back to plain
      try {
        const result = hljs.highlightAuto(code);
        highlighted = result.value;
        detectedLang = result.language || "text";
      } catch {
        highlighted = escapeHtml(code);
      }
    }

    return (
      `<div class="md-editor-codeblock">` +
      `<div class="md-editor-codeblock-header">` +
      `<span class="md-editor-codeblock-lights">` +
      `<span class="md-editor-codeblock-dot md-editor-codeblock-dot--red"></span>` +
      `<span class="md-editor-codeblock-dot md-editor-codeblock-dot--yellow"></span>` +
      `<span class="md-editor-codeblock-dot md-editor-codeblock-dot--green"></span>` +
      `</span>` +
      `<span class="md-editor-codeblock-lang">${escapeHtml(detectedLang)}</span>` +
      `<button type="button" class="md-editor-codeblock-copy" aria-label="Copy code">Copy</button>` +
      `</div>` +
      `<pre class="md-editor-codeblock-pre"><code class="language-${escapeHtml(detectedLang)}">${highlighted}</code></pre>` +
      `</div>`
    );
  };
}

import Markdown from "markdown-it";
import type { MarkdownIt } from "markdown-it";
import { useMath } from "./plugins/math.js";
import { useMindmap, hydrateMindmaps } from "./plugins/mindmap.js";
import { useCodeHighlight } from "./plugins/code.js";
import { useVideo } from "./plugins/video.js";
import { useTips } from "./plugins/tips.js";
import { useTaskList } from "./plugins/tasklist.js";
import { useDocLinkBlock } from "./plugins/doclink.js";
import { useMentionRender } from "./plugins/mention.js";
import "github-markdown-css/github-markdown.css";

export interface RendererOptions {
  /** Enable KaTeX math rendering. Default: true. */
  math?: boolean;
  /** Enable Markmap mindmap rendering. Default: true. */
  mindmap?: boolean;
  /** Enable syntax highlighting for code blocks. Default: true. */
  codeHighlight?: boolean;
  /** Enable admonition/tip blocks (:::notice, :::warning, etc.). Default: true. */
  tips?: boolean;
  /** Allow raw HTML in markdown source. Default: false (safer). */
  html?: boolean;
  /** Convert soft line breaks to <br>. Default: false. */
  breaks?: boolean;
  /**
   * Theme for standalone rendering. When set, the rendered HTML is wrapped
   * in a container with `data-theme` so that code blocks, tables, and other
   * elements inherit the correct dark/light token variables. Use this when
   * rendering markdown outside of a `.md-editor-root` container.
   */
  theme?: "light" | "dark";
}

export class Renderer {
  readonly md: MarkdownIt;
  private mindmapEnabled: boolean;

  constructor(options: RendererOptions = {}) {
    this.md = new Markdown({
      html: options.html ?? false,
      linkify: true,
      breaks: options.breaks ?? false,
      typographer: true,
    });

    if (options.math !== false) {
      useMath(this.md);
    }

    this.mindmapEnabled = options.mindmap !== false;
    if (this.mindmapEnabled) {
      useMindmap(this.md);
    }

    if (options.codeHighlight !== false) {
      useCodeHighlight(this.md, {
        reservedLanguages: this.mindmapEnabled ? ["mindmap"] : [],
      });
    }

    if (options.tips !== false) {
      useTips(this.md);
    }

    // Task list checkboxes (always enabled - standard markdown feature)
    useTaskList(this.md);

    // Document link preview cards (:::doc-link)
    useDocLinkBlock(this.md);

    // @mention badges in preview
    useMentionRender(this.md);

    // Video plugin must be registered after code highlight so that image
    // rules for video files are processed correctly.
    useVideo(this.md);
  }

  render(source: string): string {
    return this.md.render(source || "");
  }

  /**
   * Call after the rendered HTML is inserted into the DOM to hydrate
   * mindmap placeholders into real SVG diagrams.
   */
  async hydrate(container: HTMLElement): Promise<void> {
    if (!this.mindmapEnabled) return;
    try {
      await hydrateMindmaps(container);
    } catch {
      /* mindmap hydration is non-fatal; other content still renders */
    }
  }
}

/**
 * Standalone markdown rendering function with the same styling and plugins
 * as the editor preview. Use this in other parts of your app to render
 * markdown consistently without mounting an editor.
 *
 * @example
 * ```ts
 * import { renderMarkdown } from '@powerduck/md-editor';
 * import '@powerduck/md-editor/dist/style.css';
 *
 * const html = renderMarkdown('# Hello\n\n$E=mc^2$');
 * container.innerHTML = html;
 * ```
 */
export function renderMarkdown(
  source: string,
  options: RendererOptions = {},
): string {
  const renderer = new Renderer(options);
  const html = renderer.render(source);

  if (options.theme) {
    return `<div class="md-editor-standalone" data-theme="${options.theme}">${html}</div>`;
  }

  return html;
}

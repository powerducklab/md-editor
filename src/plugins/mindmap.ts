import type { MarkdownIt } from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

// markmap-view depends on ResizeObserver, which is absent in some test
// environments (jsdom). Install a no-op shim only when undefined so the
// library never throws on import/hydrate in non-browser contexts.
if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
  };
}

let mindmapSeq = 0;

// Internal fence renderer type. The options/self params use the exact
// markdown-it types via structural inference; we keep this loose because
// markdown-it's RuleRender signature is not exported as a standalone type.
type FenceRenderer = (
  tokens: Token[],
  idx: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
  env: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  self: any,
) => string;

/**
 * Intercept ```mindmap code fences and convert their content (a markdown
 * outline) into a placeholder div. The actual SVG rendering happens
 * asynchronously in hydrateMindmaps() because markdown-it renders strings
 * synchronously while markmap requires real DOM nodes.
 *
 * NESTED FENCE SUPPORT: Unlike markdown-it's built-in fence rule (which
 * closes a 3-backtick fence at the first 3-backtick line, losing nested
 * code content), this custom block rule tracks nesting depth. A line with
 * backticks + an info string (e.g. ```js) opens a nested fence; a line with
 * only backticks closes one. The mindmap block only closes when depth
 * returns to 0. This allows code examples inside mindmap outlines.
 *
 * Usage (in the editor markdown source):
 *
 * ```mindmap
 * # Root topic
 * ## Branch one
 * - Child A
 * - Child B
 * ## Branch two
 * ```
 */
export function useMindmap(md: MarkdownIt): void {
  // Custom block rule: handles mindmap fences with nested-fence awareness.
  md.block.ruler.before(
    "fence",
    "mindmap_fence",
    (state, startLine, endLine, silent) => {
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];
      const line = state.src.slice(start, max);

      // Opening fence: 3+ backticks followed by "mindmap" (case-insensitive)
      const openMatch = line.match(/^(`{3,})\s*mindmap\s*$/i);
      if (!openMatch) return false;
      if (silent) return true;

      const fenceLen = openMatch[1].length;
      let nextLine = startLine + 1;
      let depth = 1;

      while (nextLine < endLine) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineMax = state.eMarks[nextLine];
        const lineText = state.src.slice(lineStart, lineMax);

        // Check if this line is a fence (3+ backticks at start)
        const fenceMatch = lineText.match(/^(`{3,})\s*(.*)$/);
        if (fenceMatch && fenceMatch[1].length >= fenceLen) {
          const info = fenceMatch[2].trim();
          if (info) {
            // Opening nested fence (has info string, e.g. ```js)
            depth++;
          } else {
            // Closing fence (only backticks)
            depth--;
            if (depth === 0) break;
          }
        }
        nextLine++;
      }

      // If we reached endLine without closing, use what we have
      const closeLine = nextLine < endLine ? nextLine : endLine - 1;

      const token = state.push("mindmap_block", "div", 0);
      token.content = state.getLines(
        startLine + 1,
        closeLine,
        state.blkIndent,
        true,
      );
      token.map = [startLine, closeLine + 1];
      token.markup = openMatch[1];
      token.info = "mindmap";

      state.line = closeLine + 1;
      return true;
    },
  );

  // Renderer for mindmap_block tokens
  md.renderer.rules.mindmap_block = (tokens, idx): string => {
    const token = tokens[idx];
    if (!token) return "";
    const id = `md-editor-mindmap-${++mindmapSeq}`;
    const encoded = encodeURIComponent(token.content);
    return `<div class="md-editor-mindmap" id="${id}" data-source="${encoded}"></div>`;
  };

  // Also keep the fence renderer interception for backwards compatibility
  // (in case some code path still produces fence tokens with info=mindmap).
  const defaultFence: FenceRenderer = md.renderer.rules.fence
    ? (md.renderer.rules.fence as FenceRenderer).bind(md.renderer.rules)
    : (tokens, idx, options, _env, self) =>
        self.renderToken(tokens, idx, options);

  md.renderer.rules.fence = (tokens, idx, options, env, self): string => {
    const token = tokens[idx];
    if (!token) return defaultFence(tokens, idx, options, env, self);
    const info = token.info.trim().toLowerCase();
    if (info === "mindmap") {
      const id = `md-editor-mindmap-${++mindmapSeq}`;
      const encoded = encodeURIComponent(token.content);
      return `<div class="md-editor-mindmap" id="${id}" data-source="${encoded}"></div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };
}

interface MarkmapViewModule {
  Markmap?: {
    create: (
      svg: SVGSVGElement,
      options: Record<string, unknown>,
      data: unknown,
    ) => MarkmapInstance;
  };
  default?: {
    create: (
      svg: SVGSVGElement,
      options: Record<string, unknown>,
      data: unknown,
    ) => MarkmapInstance;
  };
}

interface MarkmapInstance {
  fit?: () => void;
  setData?: (data: unknown) => void;
  destroy?: () => void;
}

const DEFAULT_MINDMAP_WIDTH = 600;
const DEFAULT_MINDMAP_HEIGHT = 320;

/**
 * After the preview DOM is updated, render all non-hydrated mindmap nodes.
 * markmap-lib / markmap-view are dynamically imported so they do not
 * increase the initial bundle size when mindmaps are absent.
 *
 * CRITICAL: The SVG must have explicit pixel width/height attributes before
 * Markmap.create is called. markmap-view's d3-zoom gesture reads
 * svg.width.baseVal.value, which throws "Could not resolve relative length"
 * when the SVG only has percentage-based CSS dimensions (width:100%).
 *
 * CRITICAL 2: autoFit MUST be false at creation time. The SVG is appended
 * synchronously but the browser has not laid it out yet, so getBoundingClientRect
 * returns 0x0 and markmap computes translate(NaN,NaN) scale(NaN). d3-zoom then
 * schedules a transition from NaN, and every animation frame throws
 * "Expected number" errors (hundreds per mindmap). We defer fit() to the next
 * animation frame when layout is complete, with a setTimeout fallback for
 * environments where requestAnimationFrame does not fire (jsdom).
 */
export async function hydrateMindmaps(root: HTMLElement): Promise<void> {
  const nodes = root.querySelectorAll<HTMLDivElement>(
    ".md-editor-mindmap:not([data-hydrated])",
  );
  if (nodes.length === 0) return;

  let Transformer: typeof import("markmap-lib").Transformer;
  let MarkmapCtor: MarkmapViewModule["Markmap"] | MarkmapViewModule["default"];
  try {
    const markmapLib = await import("markmap-lib");
    Transformer = markmapLib.Transformer;
    const markmapView = (await import("markmap-view")) as MarkmapViewModule;
    MarkmapCtor = markmapView.Markmap ?? markmapView.default;
  } catch {
    // markmap failed to load (network / unsupported environment). Leave the
    // placeholders as empty divs rather than crashing the whole render.
    return;
  }
  if (!MarkmapCtor || !Transformer) return;

  const transformer = new Transformer();

  for (const node of Array.from(nodes)) {
    try {
      node.setAttribute("data-hydrated", "1");
      const source =
        decodeURIComponent(node.dataset.source ?? "") || "- Empty mindmap";
      const { root: dataRoot } = transformer.transform(source);

      node.innerHTML = "";

      // Read actual container dimensions; fall back to defaults if the
      // container has not been laid out yet (e.g. display:none).
      const width =
        node.clientWidth > 0 ? node.clientWidth : DEFAULT_MINDMAP_WIDTH;
      const height =
        node.clientHeight > 0 ? node.clientHeight : DEFAULT_MINDMAP_HEIGHT;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      // Explicit pixel attributes are REQUIRED: d3-zoom reads baseVal.value
      // which throws on percentage-only dimensions.
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      // CSS keeps it responsive within the container.
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
      node.appendChild(svg);

      // Create with autoFit:false to avoid NaN transform on zero-size layout.
      const instance = MarkmapCtor.create(svg, { autoFit: false }, dataRoot);

      // Set a sane default transform immediately so d3-zoom never reads NaN
      // from the initial state. markmap-view creates a <g> element internally.
      const setSafeTransform = () => {
        try {
          const g = svg.querySelector("g");
          if (g) {
            const t = g.getAttribute("transform") || "";
            if (!t || t.includes("NaN")) {
              g.setAttribute(
                "transform",
                `translate(40, ${height / 2}) scale(1)`,
              );
            }
          }
        } catch {
          /* ignore */
        }
      };
      setSafeTransform();

      // Defer fit to next frame so the SVG has real dimensions.
      // Use requestAnimationFrame in browsers, setTimeout in non-browser envs.
      const scheduleFit =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (cb: () => void) => setTimeout(cb, 16);

      scheduleFit(() => {
        try {
          if (!node.isConnected) return;
          const rect = svg.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            instance.fit?.();
            // Double-check after fit: some markmap versions still produce NaN
            // when the content tree is empty or malformed.
            setSafeTransform();
          }
          // If still zero-size, keep the default transform. markmap-view's
          // internal ResizeObserver will re-fit when the element gets dimensions.
        } catch {
          // fit() may throw in edge cases; the safe transform already set.
        }
      });
    } catch {
      // A single malformed mindmap must not break the rest of the document.
      // Remove the placeholder so the user sees a gap instead of a crash.
      node.removeAttribute("data-hydrated");
    }
  }
}

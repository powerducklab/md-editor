import { expect, it, vi } from "vitest";
import { hydrateMindmaps } from "../src/plugins/mindmap.js";

const create = vi.hoisted(() =>
  vi.fn((_svg: SVGElement, _options: unknown, _tree: unknown) => ({
    fit: vi.fn(),
  })),
);
vi.mock("markmap-view", () => ({ Markmap: { create } }));

it("escapes raw HTML before handing untrusted mindmap nodes to the SVG renderer", async () => {
  const container = document.createElement("div");
  const node = document.createElement("div");
  node.className = "md-editor-mindmap";
  node.dataset.source = encodeURIComponent(
    '# Root\n- <img src=x onerror="alert(1)">\n- **Safe emphasis**',
  );
  container.appendChild(node);
  await hydrateMindmaps(container);
  expect(create).toHaveBeenCalledOnce();
  const tree = JSON.stringify(create.mock.calls[0]?.[2]);
  expect(tree).not.toContain("<img");
  expect(tree).toContain("&lt;img");
  expect(tree).toContain("<strong>Safe emphasis</strong>");
});

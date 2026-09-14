import { splitIntoBlocks, type SourceBlock } from './blocks.js';

export interface IncrementalRenderResult {
  /** Number of blocks actually re-rendered (cache miss) this update */
  rerenderedCount: number;
  /** Total number of blocks in this update */
  totalCount: number;
}

/**
 * Core performance strategy:
 *
 * 1. Source is split into blocks (see blocks.ts). Only changed blocks are
 *    re-run through markdown-it / KaTeX.
 * 2. Unchanged blocks reuse their existing DOM nodes directly (including
 *    already-hydrated mindmap SVGs), with no string concatenation, innerHTML
 *    assignment, or KaTeX computation.
 * 3. Reordering is handled by appending existing nodes to a DocumentFragment
 *    -- the browser moves them natively (auto-detaching from the old parent),
 *    so no manual node-shuttling code is needed.
 * 4. The result cache is keyed by content hash (not position), so undo/redo
 *    and copy-paste of identical paragraphs also hit the cache.
 * 5. Each block is wrapped in content-visibility: auto (see editor.css), so
 *    off-screen blocks skip layout and paint entirely -- a decisive win for
 *    multi-thousand-line documents.
 */
export class IncrementalRenderer {
  private nodeByKey = new Map<string, HTMLElement>();
  private htmlByHash = new Map<string, string>();
  private prevBlocks: SourceBlock[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly renderBlock: (source: string) => string,
    private readonly maxCacheEntries = 800
  ) {}

  update(source: string): IncrementalRenderResult {
    const blocks = splitIntoBlocks(source);
    const frag = document.createDocumentFragment();
    const nextNodeByKey = new Map<string, HTMLElement>();
    let rerenderedCount = 0;

    for (const block of blocks) {
      let node = this.nodeByKey.get(block.key);
      if (!node) {
        let html = this.htmlByHash.get(block.hash);
        if (html === undefined) {
          try {
            html = this.renderBlock(block.source);
          } catch {
            // A single block failing to render must not blank the whole
            // preview. Fall back to an escaped plain-text representation.
            html = `<pre>${this.escapeHtml(block.source)}</pre>`;
          }
          this.htmlByHash.set(block.hash, html);
          rerenderedCount++;
        }
        node = document.createElement('div');
        node.className = 'md-editor-block';
        node.dataset.blockKey = block.key;
        node.innerHTML = html;
      }
      nextNodeByKey.set(block.key, node);
      // Already-mounted nodes are moved natively, not rebuilt.
      frag.appendChild(node);
    }

    this.container.innerHTML = '';
    this.container.appendChild(frag);

    this.nodeByKey = nextNodeByKey;
    this.prevBlocks = blocks;
    this.evictCacheIfNeeded(blocks);

    return { rerenderedCount, totalCount: blocks.length };
  }

  /**
   * When the cache exceeds the limit, evict hashes that no longer appear in
   * the current document to prevent unbounded memory growth during long
   * editing sessions.
   */
  private evictCacheIfNeeded(blocks: readonly SourceBlock[]): void {
    if (this.htmlByHash.size <= this.maxCacheEntries) return;
    const alive = new Set(blocks.map((b) => b.hash));
    for (const hash of Array.from(this.htmlByHash.keys())) {
      if (!alive.has(hash)) this.htmlByHash.delete(hash);
    }
  }

  getBlockCount(): number {
    return this.prevBlocks.length;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  destroy(): void {
    this.container.innerHTML = '';
    this.nodeByKey.clear();
    this.htmlByHash.clear();
    this.prevBlocks = [];
  }
}

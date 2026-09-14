import { describe, expect, it, beforeEach } from 'vitest';
import { IncrementalRenderer } from '../src/perf/IncrementalRenderer.js';

function makeContainer(): HTMLElement {
  return document.createElement('div');
}

function renderFn(source: string): string {
  return `<p>${source}</p>`;
}

describe('IncrementalRenderer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it('renders initial content into blocks', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    const result = ir.update('# A\n\nContent A\n\n# B\n\nContent B');
    expect(result.totalCount).toBe(2);
    expect(result.rerenderedCount).toBe(2);
    expect(container.querySelectorAll('.md-editor-block')).toHaveLength(2);
  });

  it('reuses unchanged DOM nodes on subsequent updates', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    ir.update('# A\n\nContent A\n\n# B\n\nContent B');
    const firstNodes = Array.from(container.querySelectorAll('.md-editor-block'));

    const result = ir.update('# A\n\nContent A\n\n# B\n\nContent B');
    expect(result.rerenderedCount).toBe(0);
    const secondNodes = Array.from(container.querySelectorAll('.md-editor-block'));
    // Same DOM node instances (not recreated)
    expect(secondNodes[0]).toBe(firstNodes[0]);
    expect(secondNodes[1]).toBe(firstNodes[1]);
  });

  it('only re-renders changed blocks', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    ir.update('# A\n\nContent A\n\n# B\n\nContent B');
    const firstNodeA = container.querySelectorAll('.md-editor-block')[0];

    const result = ir.update('# A\n\nUpdated A\n\n# B\n\nContent B');
    expect(result.rerenderedCount).toBe(1);
    // Block A was recreated, block B was reused
    const nodes = container.querySelectorAll('.md-editor-block');
    expect(nodes[0]).not.toBe(firstNodeA);
    expect(nodes[1]!.innerHTML).toContain('Content B');
  });

  it('handles empty source', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    const result = ir.update('');
    expect(result.totalCount).toBe(1);
    expect(container.querySelectorAll('.md-editor-block')).toHaveLength(1);
  });

  it('removes blocks that no longer exist', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    ir.update('# A\n\nA\n\n# B\n\nB\n\n# C\n\nC');
    expect(container.querySelectorAll('.md-editor-block')).toHaveLength(3);

    ir.update('# A\n\nA');
    expect(container.querySelectorAll('.md-editor-block')).toHaveLength(1);
  });

  it('adds new blocks', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    ir.update('# A\n\nA');
    expect(container.querySelectorAll('.md-editor-block')).toHaveLength(1);

    ir.update('# A\n\nA\n\n# B\n\nB');
    expect(container.querySelectorAll('.md-editor-block')).toHaveLength(2);
  });

  it('reorders blocks by appending to fragment', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    ir.update('# A\n\nA\n\n# B\n\nB');
    const nodeA = container.querySelectorAll('.md-editor-block')[0];
    const nodeB = container.querySelectorAll('.md-editor-block')[1];

    // Simulate reorder by changing content so hashes differ
    ir.update('# B\n\nB\n\n# A\n\nA');
    const nodes = container.querySelectorAll('.md-editor-block');
    expect(nodes[0]!.innerHTML).toContain('# B');
    expect(nodes[1]!.innerHTML).toContain('# A');
    // Original nodes may be reused if content matches
    void nodeA;
    void nodeB;
  });

  it('caches HTML by hash across updates', () => {
    const renderSpy = vi.fn(renderFn);
    const ir = new IncrementalRenderer(container, renderSpy);
    // Use single-line-per-block content to avoid trailing-newline hash differences
    ir.update('# A\ntextA\n# B\ntextB');
    const firstCallCount = renderSpy.mock.calls.length;
    expect(firstCallCount).toBe(2);

    // Remove a block then add it back -- should hit cache
    ir.update('# A\ntextA');
    ir.update('# A\ntextA\n# B\ntextB');
    expect(renderSpy.mock.calls.length).toBe(firstCallCount); // no new renders
  });

  it('evicts stale cache entries when over limit', () => {
    const ir = new IncrementalRenderer(container, renderFn, 2);
    // Create 3 unique blocks
    ir.update('# A\nA1\n# B\nB1\n# C\nC1');
    // Update to only 2 blocks, triggering eviction of C
    ir.update('# A\nA1\n# B\nB1');
    // Adding C back should require a re-render (it was evicted)
    const result = ir.update('# A\nA1\n# B\nB1\n# C\nC1');
    expect(result.rerenderedCount).toBeGreaterThanOrEqual(1);
  });

  it('getBlockCount returns current block count', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    expect(ir.getBlockCount()).toBe(0);
    ir.update('# A\n\nA\n\n# B\n\nB');
    expect(ir.getBlockCount()).toBe(2);
  });

  it('destroy clears container and internal state', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    ir.update('# A\n\nA');
    expect(container.children.length).toBeGreaterThan(0);

    ir.destroy();
    expect(container.children.length).toBe(0);
    expect(ir.getBlockCount()).toBe(0);
  });

  it('sets data-block-key on each block', () => {
    const ir = new IncrementalRenderer(container, renderFn);
    ir.update('# A\n\nA');
    const block = container.querySelector('.md-editor-block');
    expect(block?.getAttribute('data-block-key')).toBeTruthy();
  });
});

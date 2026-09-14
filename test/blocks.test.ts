import { describe, expect, it } from 'vitest';
import { splitIntoBlocks } from '../src/perf/blocks.js';

describe('splitIntoBlocks', () => {
  it('returns a single empty block for empty string', () => {
    const blocks = splitIntoBlocks('');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source).toBe('');
  });

  it('returns a single block for content with no headings', () => {
    const src = 'Hello world\n\nThis is a paragraph.\n\nAnother paragraph.';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source).toBe(src);
  });

  it('splits at ATX headings (# through ######)', () => {
    const src = '# Title\n\nIntro.\n\n## Section 1\n\nContent 1.\n\n### Sub\n\nSub content.\n\n## Section 2\n\nContent 2.';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(4);
    expect(blocks[0]!.source).toContain('# Title');
    expect(blocks[1]!.source).toContain('## Section 1');
    expect(blocks[2]!.source).toContain('### Sub');
    expect(blocks[3]!.source).toContain('## Section 2');
  });

  it('does not split on headings inside code fences', () => {
    const src = '# Real heading\n\n```\n# Not a heading\n## Also not\n```\n\n## After fence';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.source).toContain('# Not a heading');
    expect(blocks[1]!.source).toContain('## After fence');
  });

  it('does not split on headings inside tilde fences', () => {
    const src = '# Real\n\n~~~\n# fake\n~~~\n\n## Real two';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
  });

  it('handles mixed fence types correctly', () => {
    const src = '# A\n\n```\n# fake\n~~~\nstill inside\n```\n\n## B';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
  });

  it('generates stable hashes for identical content', () => {
    // No blank line between blocks so both chunks are byte-identical
    const src = '# A\ntext\n# A\ntext';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.hash).toBe(blocks[1]!.hash);
    // Keys differ by occurrence index even when hash is the same
    expect(blocks[0]!.key).not.toBe(blocks[1]!.key);
    expect(blocks[0]!.key).toContain('#1');
    expect(blocks[1]!.key).toContain('#2');
  });

  it('hash includes content length to reduce collisions', () => {
    const blocks = splitIntoBlocks('# A\n\nshort');
    // Key format: base36hash:length#occurrence
    expect(blocks[0]!.key).toMatch(/:\d+#\d+$/);
  });

  it('preserves leading content before the first heading', () => {
    const src = 'Preface paragraph.\n\n# Heading\n\nBody.';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.source).toContain('Preface paragraph.');
    expect(blocks[1]!.source).toContain('# Heading');
  });

  it('handles headings with leading spaces (up to 3)', () => {
    const src = '   # Indented heading\n\nContent.\n\n## Normal';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
  });

  it('does not split on 4-space indented # (code block)', () => {
    const src = '# Real\n\n    # Not a heading (4 spaces)\n\n## Real two';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
  });

  it('handles a document that is only a heading', () => {
    const blocks = splitIntoBlocks('# Only heading');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source).toBe('# Only heading');
  });

  it('handles consecutive headings with no body', () => {
    const src = '# A\n## B\n### C';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(3);
  });

  it('does not split inside a 4-backtick fence containing 3-backtick fences', () => {
    const src = [
      '## Mindmap Syntax',
      '',
      '````markdown',
      '```mindmap',
      '# Root topic',
      '## Branch one',
      '- Child A',
      '```',
      '````',
      '',
      '## Code Blocks',
    ].join('\n');
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.source).toContain('````markdown');
    expect(blocks[0]!.source).toContain('```mindmap');
    expect(blocks[0]!.source).toContain('# Root topic');
    expect(blocks[0]!.source).toContain('## Branch one');
    expect(blocks[0]!.source).toContain('````');
    expect(blocks[1]!.source).toContain('## Code Blocks');
  });

  it('treats a 3-backtick line with info string inside a 4-backtick fence as content', () => {
    const src = '# Title\n\n````\n```js\nconst x = 1;\n```\n````\n\n## After';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.source).toContain('```js');
    expect(blocks[0]!.source).toContain('const x = 1;');
  });

  it('closes a fence at a same-length marker with no info string', () => {
    const src = '# A\n\n```\ncode\n```\n\n## B';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
  });
});

describe('splitIntoBlocks - ::: custom containers', () => {
  it('keeps :::doc-link block intact (headings inside are not split points)', () => {
    const src = [
      ':::doc-link https://docs.example.com/start',
      '# Getting Started',
      '![thumbnail](https://picsum.photos/seed/start/96/72)',
      'Quick start guide',
      ':::',
    ].join('\n');
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source).toContain(':::doc-link');
    expect(blocks[0]!.source).toContain('# Getting Started');
    expect(blocks[0]!.source).toContain('Quick start guide');
    expect(blocks[0]!.source).toContain(':::');
  });

  it('keeps multiple :::doc-link blocks intact', () => {
    const src = [
      '# Top',
      '',
      ':::doc-link https://a.com',
      '# Title A',
      'Desc A',
      ':::',
      '',
      '## Middle',
      '',
      ':::doc-link https://b.com',
      '# Title B',
      'Desc B',
      ':::',
    ].join('\n');
    const blocks = splitIntoBlocks(src);
    // Two split points: # Top and ## Middle. Each doc-link stays intact.
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.source).toContain(':::doc-link https://a.com');
    expect(blocks[0]!.source).toContain('# Title A');
    expect(blocks[1]!.source).toContain(':::doc-link https://b.com');
    expect(blocks[1]!.source).toContain('# Title B');
  });

  it('keeps :::warning admonition block intact', () => {
    const src = [
      ':::warning',
      '# Warning title',
      'Warning content',
      ':::',
    ].join('\n');
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source).toContain(':::warning');
    expect(blocks[0]!.source).toContain('# Warning title');
  });

  it('still splits at headings outside containers', () => {
    const src = '# A\n\ntext\n\n## B\n\nmore';
    const blocks = splitIntoBlocks(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.source).toContain('# A');
    expect(blocks[1]!.source).toContain('## B');
  });
});

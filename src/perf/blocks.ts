export interface SourceBlock {
  /** Stable key for DOM node reuse (content hash + occurrence index) */
  key: string;
  /** Content hash used to detect whether this block changed */
  hash: string;
  /** Original markdown source for this block */
  source: string;
}

const HEADING_RE = /^ {0,3}#{1,6}\s/;
// Opening or closing fence: 3+ backticks or tildes at line start.
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
// A closing fence has no info string — only the marker and optional trailing whitespace.
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})\s*$/;
// Custom container opener: 3+ colons followed immediately by a type name,
// e.g. ":::doc-link url", ":::warning", ":::tip Title". The char after colons
// must be non-whitespace (a closer like ":::" has nothing after the colons).
const CONTAINER_OPEN_RE = /^ {0,3}:{3,}\S/;
// Custom container closer: 3+ colons with only trailing whitespace.
const CONTAINER_CLOSE_RE = /^ {0,3}:{3,}\s*$/;

/**
 * Fast non-cryptographic string hash (djb2 variant). Used only to detect
 * content changes, not for collision resistance.
 */
function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36) + ':' + input.length;
}

/**
 * Split a markdown document into blocks at ATX heading lines (# through ######).
 *
 * This split is safe under CommonMark semantics: a heading line is always the
 * start of a new block, so unlike splitting on blank lines we never break
 * list or blockquote structures that span blank lines.
 *
 * Content inside code fences (``` or ~~~) is never treated as a heading,
 * preventing "# comment" in example code from being misread as a split point.
 *
 * Documents with no headings degrade to a single block. In that case
 * incremental rendering falls back to full-document rendering, but the
 * cross-edit result cache (htmlByHash) is still effective.
 */
export function splitIntoBlocks(source: string): SourceBlock[] {
  const lines = source.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;
  // Track ::: custom containers (doc-link, admonition, etc.) so that headings
  // inside them are NOT treated as block split points.
  let inContainer = false;

  for (const line of lines) {
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[1] ?? '';
      const char = marker[0] ?? '';
      const len = marker.length;
      if (!inFence) {
        inFence = true;
        fenceChar = char;
        fenceLen = len;
      } else if (
        char === fenceChar &&
        len >= fenceLen &&
        FENCE_CLOSE_RE.test(line)
      ) {
        inFence = false;
      }
      current.push(line);
      continue;
    }

    // Track ::: custom containers. An opener has a type name after the colons;
    // a closer is bare colons. Containers cannot nest in our syntax.
    if (!inFence) {
      if (!inContainer && CONTAINER_OPEN_RE.test(line)) {
        inContainer = true;
      } else if (inContainer && CONTAINER_CLOSE_RE.test(line)) {
        inContainer = false;
      }
    }

    if (!inFence && !inContainer && HEADING_RE.test(line) && current.length > 0) {
      chunks.push(current.join('\n'));
      current = [line];
      continue;
    }

    current.push(line);
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  if (chunks.length === 0) chunks.push('');

  const occurrences = new Map<string, number>();
  return chunks.map((chunkSource) => {
    const hash = hashString(chunkSource);
    const n = (occurrences.get(hash) ?? 0) + 1;
    occurrences.set(hash, n);
    return { key: `${hash}#${n}`, hash, source: chunkSource };
  });
}

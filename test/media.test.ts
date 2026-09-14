import { describe, expect, it } from 'vitest';
import {
  extractYouTubeId,
  youTubeEmbedMarkdown,
  imageMarkdown,
  videoMarkdown,
  isVideoFile
} from '../src/plugins/media.js';

describe('extractYouTubeId', () => {
  it('extracts from standard watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from watch URL with extra query params', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=abc123XYZ__&feature=shared')).toBe(
      'abc123XYZ__'
    );
  });

  it('extracts from youtu.be short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from embed URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from shorts URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from /v/ URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts a raw 11-character video ID', () => {
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('handles http (not https)', () => {
    expect(extractYouTubeId('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('handles m.youtube.com mobile domain', () => {
    expect(extractYouTubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for empty string', () => {
    expect(extractYouTubeId('')).toBeNull();
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeId('https://example.com/video')).toBeNull();
  });

  it('returns null for a string that is too short to be an ID', () => {
    expect(extractYouTubeId('abc')).toBeNull();
  });

  it('trims whitespace before parsing', () => {
    expect(extractYouTubeId('  https://youtu.be/dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ');
  });
});

describe('youTubeEmbedMarkdown', () => {
  it('produces a linked thumbnail image', () => {
    const md = youTubeEmbedMarkdown('dQw4w9WgXcQ');
    expect(md).toContain('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(md).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(md).toMatch(/^\[!\[.*\]\(.*\)\]\(.*\)$/);
  });

  it('uses custom alt text', () => {
    const md = youTubeEmbedMarkdown('abc123', 'My video');
    expect(md).toContain('My video');
  });
});

describe('imageMarkdown', () => {
  it('produces a markdown image', () => {
    expect(imageMarkdown('https://example.com/pic.png')).toBe('![image](https://example.com/pic.png)');
  });

  it('uses custom alt text', () => {
    expect(imageMarkdown('https://example.com/pic.png', 'A cat')).toBe(
      '![A cat](https://example.com/pic.png)'
    );
  });
});

describe('videoMarkdown', () => {
  it('produces a markdown image with video URL', () => {
    expect(videoMarkdown('https://example.com/clip.mp4')).toBe(
      '![video](https://example.com/clip.mp4)'
    );
  });
});

describe('isVideoFile', () => {
  it('detects .mp4', () => {
    expect(isVideoFile('https://example.com/clip.mp4')).toBe(true);
  });

  it('detects .webm', () => {
    expect(isVideoFile('https://example.com/clip.webm')).toBe(true);
  });

  it('detects .ogg', () => {
    expect(isVideoFile('https://example.com/clip.ogg')).toBe(true);
  });

  it('detects .mov', () => {
    expect(isVideoFile('https://example.com/clip.mov')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isVideoFile('https://example.com/clip.MP4')).toBe(true);
  });

  it('ignores query strings', () => {
    expect(isVideoFile('https://example.com/clip.mp4?t=10')).toBe(true);
  });

  it('returns false for images', () => {
    expect(isVideoFile('https://example.com/pic.png')).toBe(false);
  });

  it('returns false for non-video URLs', () => {
    expect(isVideoFile('https://example.com/page')).toBe(false);
  });
});

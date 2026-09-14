const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.avi', '.mkv'];

const YOUTUBE_PATTERNS: readonly RegExp[] = [
  /(?:youtube\.com\/watch\?[^ ]*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  /^([a-zA-Z0-9_-]{11})$/,
];

/**
 * Extract a YouTube video ID from various URL formats.
 * Supports: watch?v=, youtu.be/, embed/, shorts/, v/, and raw 11-char IDs.
 * Returns null if the input is not a recognizable YouTube URL.
 */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * Build a markdown image link that renders as a clickable YouTube thumbnail.
 * The thumbnail links to the YouTube watch page.
 */
export function youTubeEmbedMarkdown(videoId: string, alt = 'YouTube video'): string {
  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return `[![${alt}](${thumbnail})](${watchUrl})`;
}

/** Check if a URL points to a video file based on its extension. */
export function isVideoFile(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0] ?? '';
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Build markdown for an image insertion.
 */
export function imageMarkdown(url: string, alt = 'image'): string {
  return `![${alt}](${url})`;
}

/**
 * Build markdown for a video file. Uses a linked image as a fallback for
 * renderers that do not support <video> tags; the Renderer also registers
 * a custom image rule that renders video URLs as <video> elements.
 */
export function videoMarkdown(url: string, alt = 'video'): string {
  return `![${alt}](${url})`;
}

import type { MarkdownIt } from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import { isVideoFile } from "./media.js";

type ImageRenderer = (
  tokens: Token[],
  idx: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
  env: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  self: any,
) => string;

/**
 * Override the markdown-it image renderer to detect video file URLs
 * (.mp4, .webm, .ogg, etc.) and render them as <video> elements instead
 * of <img>. Non-video images fall through to the default renderer.
 */
export function useVideo(md: MarkdownIt): void {
  const defaultImage: ImageRenderer = md.renderer.rules.image
    ? (md.renderer.rules.image as ImageRenderer).bind(md.renderer.rules)
    : (tokens, idx, options, _env, self) =>
        self.renderToken(tokens, idx, options);

  md.renderer.rules.image = (tokens, idx, options, env, self): string => {
    const token = tokens[idx];
    if (!token) return defaultImage(tokens, idx, options, env, self);

    const src = token.attrGet("src") ?? "";
    if (isVideoFile(src)) {
      const alt = token.content || "";
      return `<video src="${src}" controls class="md-editor-video" title="${alt}">${alt}</video>`;
    }
    return defaultImage(tokens, idx, options, env, self);
  };
}

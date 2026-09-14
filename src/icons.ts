/**
 * Lightweight line icons at 24x24 viewBox, Lucide/Feather-inspired.
 * Color uses currentColor so CSS variables control all icons uniformly.
 * Stroke width 1.75 for crisp rendering at toolbar size.
 */
const wrap = (paths: string): string =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const icons = {
  // ---- Text formatting ----
  bold: wrap(
    '<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>' +
    '<path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>'
  ),
  italic: wrap(
    '<line x1="19" y1="4" x2="10" y2="4"/>' +
    '<line x1="14" y1="20" x2="5" y2="20"/>' +
    '<line x1="15" y1="4" x2="9" y2="20"/>'
  ),
  heading: wrap(
    '<path d="M6 12h12"/>' +
    '<path d="M6 4v16"/>' +
    '<path d="M18 4v16"/>'
  ),
  link: wrap(
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
  ),
  code: wrap(
    '<polyline points="16 18 22 12 16 6"/>' +
    '<polyline points="8 6 2 12 8 18"/>'
  ),

  // ---- Media ----
  image: wrap(
    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
    '<circle cx="8.5" cy="8.5" r="1.5"/>' +
    '<polyline points="21 15 16 10 5 21"/>'
  ),
  video: wrap(
    '<polygon points="23 7 16 12 23 17 23 7"/>' +
    '<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'
  ),
  youtube: wrap(
    '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>' +
    '<polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>'
  ),

  // ---- Blocks ----
  quote: wrap(
    '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>' +
    '<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>'
  ),
  list: wrap(
    '<line x1="8" y1="6" x2="21" y2="6"/>' +
    '<line x1="8" y1="12" x2="21" y2="12"/>' +
    '<line x1="8" y1="18" x2="21" y2="18"/>' +
    '<line x1="3" y1="6" x2="3.01" y2="6"/>' +
    '<line x1="3" y1="12" x2="3.01" y2="12"/>' +
    '<line x1="3" y1="18" x2="3.01" y2="18"/>'
  ),
  listOrdered: wrap(
    '<line x1="10" y1="6" x2="21" y2="6"/>' +
    '<line x1="10" y1="12" x2="21" y2="12"/>' +
    '<line x1="10" y1="18" x2="21" y2="18"/>' +
    '<path d="M4 6h1v4"/>' +
    '<path d="M4 10h2"/>' +
    '<path d="M6 16H4c0-1 2-2 2-3s-1-1.5-2-1"/>'
  ),
  taskList: wrap(
    '<rect x="3" y="4" width="6" height="6" rx="1"/>' +
    '<polyline points="4.5 7 5.5 8 7.5 5.5"/>' +
    '<line x1="13" y1="7" x2="21" y2="7"/>' +
    '<rect x="3" y="14" width="6" height="6" rx="1"/>' +
    '<line x1="13" y1="17" x2="21" y2="17"/>'
  ),
  mention: wrap(
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>'
  ),
  fileText: wrap(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
    '<polyline points="14 2 14 8 20 8"/>' +
    '<line x1="16" y1="13" x2="8" y2="13"/>' +
    '<line x1="16" y1="17" x2="8" y2="17"/>' +
    '<polyline points="10 9 9 9 8 9"/>'
  ),
  table: wrap(
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<line x1="3" y1="9" x2="21" y2="9"/>' +
    '<line x1="3" y1="15" x2="21" y2="15"/>' +
    '<line x1="9" y1="3" x2="9" y2="21"/>'
  ),
  hr: wrap(
    '<line x1="4" y1="12" x2="20" y2="12"/>'
  ),
  alert: wrap(
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
    '<line x1="12" y1="9" x2="12" y2="13"/>' +
    '<line x1="12" y1="17" x2="12.01" y2="17"/>'
  ),

  // ---- Special ----
  sigma: wrap(
    '<path d="M18 7V4H6l6 8-6 8h12v-3"/>'
  ),
  mindmap: wrap(
    '<circle cx="12" cy="12" r="3"/>' +
    '<circle cx="4" cy="5" r="2"/>' +
    '<circle cx="4" cy="19" r="2"/>' +
    '<circle cx="20" cy="5" r="2"/>' +
    '<circle cx="20" cy="19" r="2"/>' +
    '<line x1="9.5" y1="10.5" x2="5.5" y2="6.5"/>' +
    '<line x1="9.5" y1="13.5" x2="5.5" y2="17.5"/>' +
    '<line x1="14.5" y1="10.5" x2="18.5" y2="6.5"/>' +
    '<line x1="14.5" y1="13.5" x2="18.5" y2="17.5"/>'
  ),
  eye: wrap(
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
    '<circle cx="12" cy="12" r="3"/>'
  ),
  help: wrap(
    '<circle cx="12" cy="12" r="10"/>' +
    '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>' +
    '<line x1="12" y1="17" x2="12.01" y2="17"/>'
  ),
  moon: wrap(
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
  ),
  sun: wrap(
    '<circle cx="12" cy="12" r="5"/>' +
    '<line x1="12" y1="1" x2="12" y2="3"/>' +
    '<line x1="12" y1="21" x2="12" y2="23"/>' +
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>' +
    '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
    '<line x1="1" y1="12" x2="3" y2="12"/>' +
    '<line x1="21" y1="12" x2="23" y2="12"/>' +
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>' +
    '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
  ),
  refresh: wrap(
    '<polyline points="23 4 23 10 17 10"/>' +
    '<polyline points="1 20 1 14 7 14"/>' +
    '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'
  )
} as const;

export type IconName = keyof typeof icons;

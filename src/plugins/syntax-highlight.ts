import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';

/**
 * Markdown syntax highlighting themes.
 *
 * Colors follow the GitHub-inspired palette used across the PowerDuck
 * product family. Headings are violet, code is green, links are blue,
 * code language labels are red. Markup punctuation (#, -, >, `) is
 * rendered in a muted tone so the content stays prominent.
 *
 * CodeMirror applies these styles incrementally (only re-highlight changed
 * ranges), so there is no performance penalty for large documents.
 *
 * Tag mapping reference (@lezer/markdown styleTags):
 *   ATXHeading1..6/...  -> tags.heading1..6 (sub-tags of tags.heading)
 *   OrderedList/...     -> tags.list
 *   Blockquote/...      -> tags.quote
 *   InlineCode/CodeText -> tags.monospace
 *   CodeInfo/LinkLabel  -> tags.labelName  (fenced code language string)
 *   URL/Autolink        -> tags.url
 *   Link/... Image/...  -> tags.link
 *   StrongEmphasis/...  -> tags.strong
 *   Emphasis/...        -> tags.emphasis
 *   HorizontalRule      -> tags.contentSeparator
 *   HeaderMark/ListMark/QuoteMark/CodeMark/LinkMark -> tags.processingInstruction
 */

/* ------------------------------------------------------------------ */
/* Light theme                                                         */
/* ------------------------------------------------------------------ */

const lightStyle = HighlightStyle.define([
  /* Headings: violet, semibold. tags.heading matches heading1..6 */
  { tag: tags.heading, color: '#8250df', fontWeight: '600' },

  /* List content: inherit default ink (markers get processingInstruction) */
  { tag: tags.list, color: '#1f2328' },

  /* Blockquote: muted gray */
  { tag: tags.quote, color: '#6e7781' },

  /* Inline code + fenced code text: green */
  { tag: tags.monospace, color: '#0a6640' },

  /* Code block info string (language label): red */
  { tag: tags.labelName, color: '#cf222e' },

  /* Links: blue */
  { tag: tags.link, color: '#0969da' },
  { tag: tags.url, color: '#0969da' },

  /* Strong / emphasis: inherit ink with weight/style */
  { tag: tags.strong, color: '#1f2328', fontWeight: '700' },
  { tag: tags.emphasis, color: '#1f2328', fontStyle: 'italic' },

  /* Strikethrough */
  { tag: tags.strikethrough, color: '#6e7781', textDecoration: 'line-through' },

  /* Horizontal rule (--- ***): muted gray */
  { tag: tags.contentSeparator, color: '#6e7781' },

  /* Markup punctuation: #, -, *, >, `, [, ], etc. Muted so content wins. */
  { tag: tags.processingInstruction, color: '#6e7781' },

  /* HTML tags inside markdown */
  { tag: tags.tagName, color: '#cf222e' },
  { tag: tags.attributeName, color: '#0550ae' },
  { tag: tags.attributeValue, color: '#0a6640' },

  /* Comments */
  { tag: tags.comment, color: '#6e7781', fontStyle: 'italic' },

  /* Escape characters (\# \*): muted */
  { tag: tags.escape, color: '#6e7781' },

  /* Link title: green string */
  { tag: tags.string, color: '#0a6640' },

  /*
   * Nested code-block language highlighting (codeLanguages).
   * These tags come from the embedded language parser inside fenced blocks.
   * GitHub light palette.
   */
  { tag: tags.keyword, color: '#cf222e' },
  { tag: tags.definition(tags.variableName), color: '#6639ba' },
  { tag: tags.typeName, color: '#953800' },
  { tag: tags.number, color: '#0550ae' },
  { tag: tags.bool, color: '#0550ae' },
  { tag: tags.function(tags.variableName), color: '#8250df' },
  { tag: tags.punctuation, color: '#57606a' },
  { tag: tags.operator, color: '#57606a' },
]);

/* ------------------------------------------------------------------ */
/* Dark theme                                                          */
/* ------------------------------------------------------------------ */

const darkStyle = HighlightStyle.define([
  /* Headings: light violet */
  { tag: tags.heading, color: '#c4b5fd', fontWeight: '600' },

  /* List content: inherit ink */
  { tag: tags.list, color: '#edf2f7' },

  /* Blockquote: muted gray */
  { tag: tags.quote, color: '#768390' },

  /* Code: soft green */
  { tag: tags.monospace, color: '#86efac' },

  /* Code block info string (language label): soft red */
  { tag: tags.labelName, color: '#ff9b9b' },

  /* Links: soft blue */
  { tag: tags.link, color: '#8eb5ff' },
  { tag: tags.url, color: '#8eb5ff' },

  /* Strong / emphasis */
  { tag: tags.strong, color: '#edf2f7', fontWeight: '700' },
  { tag: tags.emphasis, color: '#edf2f7', fontStyle: 'italic' },

  /* Strikethrough */
  { tag: tags.strikethrough, color: '#768390', textDecoration: 'line-through' },

  /* Horizontal rule */
  { tag: tags.contentSeparator, color: '#768390' },

  /* Markup punctuation: muted */
  { tag: tags.processingInstruction, color: '#768390' },

  /* HTML tags */
  { tag: tags.tagName, color: '#ff9b9b' },
  { tag: tags.attributeName, color: '#8eb5ff' },
  { tag: tags.attributeValue, color: '#86efac' },

  /* Comments */
  { tag: tags.comment, color: '#768390', fontStyle: 'italic' },

  /* Escape */
  { tag: tags.escape, color: '#768390' },

  /* Link title */
  { tag: tags.string, color: '#86efac' },

  /* Nested code-block language highlighting — GitHub dark palette */
  { tag: tags.keyword, color: '#ff9b9b' },
  { tag: tags.definition(tags.variableName), color: '#c4b5fd' },
  { tag: tags.typeName, color: '#e7b96e' },
  { tag: tags.number, color: '#8eb5ff' },
  { tag: tags.bool, color: '#8eb5ff' },
  { tag: tags.function(tags.variableName), color: '#c4b5fd' },
  { tag: tags.punctuation, color: '#98a4b4' },
  { tag: tags.operator, color: '#98a4b4' },
]);

/** Pre-built extensions for direct use in an EditorState. */
export const markdownLightHighlight: Extension = syntaxHighlighting(lightStyle);
export const markdownDarkHighlight: Extension = syntaxHighlighting(darkStyle);

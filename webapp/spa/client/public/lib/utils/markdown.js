import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * @method markdownInline
 * @abstract Render a markdown string as sanitized inline HTML.
 * Does not produce block-level elements (no wrapping <p>, <div>, etc.),
 * making it safe to use inside <h1>–<h6>, <a>, and similar elements.
 *
 * @param {string} text - Raw markdown (or plain text)
 * @returns {string} Sanitized HTML string
 */
export function markdownInline(text) {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parseInline(text));
}

/**
 * @method markdownBlock
 * @description Render a markdown string as sanitized block HTML.
 * Produces full block-level output (paragraphs, lists, headings, etc.).
 * Use with <ucdlib-md> or unsafeHTML() in a block container.
 *
 * @param {string} text - Raw markdown (or plain text)
 * @returns {string} Sanitized HTML string
 */
export function markdownBlock(text) {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parse(text));
}

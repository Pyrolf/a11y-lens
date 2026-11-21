import { normalizeHeadingOrder } from './normalizeHeadingOrder';

/**
 * Post-process LLM output: enforce deterministic rules the model may miss.
 * Normalizes duplicate h1s to h2 before closing skipped heading levels, then
 * fixes vague link text and rewrites positive tabindex values like "01" to 0.
 */

const VAGUE_LINK_NAMES = new Set(['click here', 'read more', 'learn more', 'here']);

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasReadableWords(value: string): boolean {
  return /[\p{L}\p{N}]{2,}/u.test(value.trim());
}

function isCloseIntent(tag: string, inner: string): boolean {
  const haystack = `${tag} ${inner}`.toLowerCase();
  if (/\b(close|dismiss|cancel-dialog|modal-close)\b/.test(haystack)) return true;
  if (/[×✕✖╳]/.test(inner)) return true;
  return /m\s*3\s+3\s*l\s*10\s+10|m\s*13\s+3\s*l?\s*-?10\s+10|l\s*10\s+10\s*m\s*0\s*-10\s*l\s*-10\s+10/i.test(inner);
}

function accessibleControlLabel(tag: string, inner: string): string {
  if (isCloseIntent(tag, inner)) return 'Close dialog';
  return /^<a\b/i.test(tag) ? 'View details' : 'Action button';
}

function getAttr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? '';
}

function setOrAddAttr(tag: string, name: string, value: string): string {
  const escaped = escapeHtmlAttr(value);
  const attrRe = new RegExp(`\\b(${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  if (attrRe.test(tag)) return tag.replace(attrRe, `${name}="${escaped}"`);
  return tag.replace(/\s*(\/?>)$/, ` ${name}="${escaped}"$1`);
}

function shortenContext(value: string, maxWords = 9): string {
  const clean = stripTags(value);
  if (!clean) return '';
  const words = clean.split(' ');
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}…` : clean;
}

function linkContext(html: string, linkIndex: number, linkTag: string): string {
  const before = html.slice(0, linkIndex);
  const headings = Array.from(before.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi));
  if (headings.length > 0) {
    const text = shortenContext(headings[headings.length - 1][2]);
    if (text) return text;
  }

  const captions = Array.from(
    before.matchAll(/<(p|figcaption|caption|label|dt)\b[^>]*>([\s\S]*?)<\/\1>/gi),
  );
  if (captions.length > 0) {
    const text = shortenContext(captions[captions.length - 1][2]);
    if (text) return text;
  }

  const href = getAttr(linkTag, 'href') ?? '';
  if (href && href !== '#') {
    const segment = href
      .split(/[/?#]/)
      .filter(Boolean)
      .pop()
      ?.replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    if (segment) return segment;
  }

  return 'this content';
}

function descriptiveLinkLabel(context: string): string {
  const clean = stripTags(context);
  if (!clean) return 'View details';
  return `Read about ${clean}`;
}

/** Replace vague link text like "Learn more", "Click here", "Read more", "Here". */
function fixVagueLinkText(html: string): string {
  let out = html.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, attrs: string, inner: string, offset: number) => {
      const tag = `<a${attrs}>`;
      const ariaLabel = (getAttr(tag, 'aria-label') ?? '').trim();
      const labelledBy = (getAttr(tag, 'aria-labelledby') ?? '').trim();
      const visibleText = stripTags(inner);

      if (labelledBy) return full;

      const effectiveName = ariaLabel || visibleText;
      const normalized = effectiveName.toLowerCase().replace(/[.!?]+$/, '').trim();
      if (VAGUE_LINK_NAMES.has(normalized)) {
        const label = descriptiveLinkLabel(linkContext(out, offset, tag));
        const nextTag = setOrAddAttr(tag, 'aria-label', label);
        const nextInner = /<[a-z][\w:-]*\b/i.test(inner) ? inner : label;
        return `${nextTag}${nextInner}</a>`;
      }

      if (ariaLabel && hasReadableWords(ariaLabel)) return full;
      if (hasReadableWords(visibleText)) return full;

      const label = accessibleControlLabel(tag, inner);
      return `${setOrAddAttr(tag, 'aria-label', label)}${inner}</a>`;
    },
  );
  return out;
}

/** Add accessible names to buttons and links that lack readable words. */
function fixMissingAccessibleNames(html: string): string {
  return html.replace(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, kind: string, attrs: string, inner: string) => {
    const tag = `<${kind.toLowerCase()}${attrs}>`;
    const ariaLabel = (getAttr(tag, 'aria-label') ?? '').trim();
    const labelledBy = (getAttr(tag, 'aria-labelledby') ?? '').trim();
    const visibleText = stripTags(inner);

    if (labelledBy) return full;
    if (ariaLabel && hasReadableWords(ariaLabel)) return full;
    if (hasReadableWords(visibleText)) return full;

    const label = accessibleControlLabel(tag, inner);
    return `${setOrAddAttr(tag, 'aria-label', label)}${inner}</${kind.toLowerCase()}>`;
  });
}

/** Rewrite any positive tabindex to 0. */
function fixPositiveTabindex(html: string): string {
  return html.replace(
    /\b(tabindex\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (match, prefix: string, double?: string, single?: string, bare?: string) => {
      const raw = double ?? single ?? bare ?? '0';
      const value = Number(raw);
      return Number.isInteger(value) && value > 0 ? `${prefix}"0"` : match;
    },
  );
}

/** Apply guardrails to LLM-generated HTML. */
export function postProcessLlmHtml(html: string): string {
  let out = normalizeHeadingOrder(html);
  out = fixVagueLinkText(out);
  out = fixMissingAccessibleNames(out);
  out = fixPositiveTabindex(out);
  return out;
}

import { buildDiff } from '../buildDiff';
import { normalizeHeadingOrder } from '../normalizeHeadingOrder';
import { contrastRatio, parseColor } from '../../../utils/wcagAuditor';
import { AA_LARGE_TEXT_RATIO, AA_NORMAL_TEXT_RATIO } from '../../../utils/colorMath';
import type { AuditRuleId } from '../../../types/audit';
import {
  TAILWIND_COLORS,
  TAILWIND_FONT_WEIGHTS,
  isLargeText,
  parseFontSizePx,
  tailwindColorForClass,
  tailwindFontWeightForClass,
  tailwindFontSizeForClass,
} from '../../../utils/styleResolver';
import type { AiFixRequest, AiFixResult } from '../../../types/ai';

const VAGUE_LINK_NAMES = new Set(['click here', 'read more', 'learn more', 'here']);
const FOCUS_OUTLINE_CLASSES = ['focus-visible:outline-2', 'focus-visible:outline-indigo-500'];
const VIEWPORT_CONTENT = 'width=device-width, initial-scale=1';

const DEMO_RULE_HANDLERS: Record<string, AuditRuleId | 'duplicate-id' | 'aria-valid-attr' | 'aria-required-attr' | 'meta-viewport' | 'list' | 'listitem' | 'frame-title'> = {
  'image-alt': 'image-alt',
  'button-name': 'accessible-name',
  'link-name': 'accessible-name',
  label: 'form-label',
  'select-name': 'form-label',
  'color-contrast': 'color-contrast',
  'heading-order': 'heading-order',
  tabindex: 'positive-tabindex',
  'frame-title': 'frame-title',
  'meta-viewport': 'meta-viewport',
  list: 'list',
  listitem: 'listitem',
  'duplicate-id': 'duplicate-id',
  'aria-valid-attr': 'aria-valid-attr',
  'aria-required-attr': 'aria-required-attr',
  'vague-link-text': 'vague-link-text',
  'accessible-name': 'accessible-name',
  'form-label': 'form-label',
  'positive-tabindex': 'positive-tabindex',
  'focus-outline': 'focus-outline',
};
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const NON_TEXT_TAGS = new Set(['script', 'style', 'template']);
// These have an opaque user-agent background that source-level resolution cannot see.
const UA_BACKGROUND_TAGS = new Set(['button', 'input', 'select', 'textarea', 'option', 'optgroup']);

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
  // Treat symbol-only names like ×, ✕, ..., or icon glyphs as non-readable.
  return /[\p{L}\p{N}]{2,}/u.test(value.trim());
}

function isCloseIntent(tag: string, inner: string): boolean {
  const haystack = `${tag} ${inner}`.toLowerCase();
  if (/\b(close|dismiss|cancel-dialog|modal-close)\b/.test(haystack)) return true;
  if (/[×✕✖╳]/.test(inner)) return true;
  // Common close icon paths.
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

function removeAttr(tag: string, name: string): string {
  return tag.replace(new RegExp(`\\s+\\b${name}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, 'i'), '');
}

function parseInlineStyle(style: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (prop && val) map.set(prop, val);
  }
  return map;
}

function serializeInlineStyle(map: Map<string, string>): string {
  return map.size ? Array.from(map.entries()).map(([k, v]) => `${k}: ${v}`).join('; ') + ';' : '';
}

function updateInlineStyle(tag: string, updater: (decls: Map<string, string>) => void): string {
  const style = getAttr(tag, 'style') ?? '';
  const decls = parseInlineStyle(style);
  updater(decls);
  const next = serializeInlineStyle(decls);
  if (!next.trim()) return removeAttr(tag, 'style');
  return setOrAddAttr(tag, 'style', next);
}

interface ForegroundCandidate {
  className: string;
  color: string;
}

// Dark backdrops prefer near-white text; light backdrops prefer near-black text.
const DARK_FOREGROUND_CANDIDATES: ForegroundCandidate[] = [
  { className: 'text-slate-100', color: TAILWIND_COLORS['slate-100'] },
  { className: 'text-white', color: TAILWIND_COLORS.white },
  { className: 'text-slate-900', color: TAILWIND_COLORS['slate-900'] },
];

const LIGHT_FOREGROUND_CANDIDATES: ForegroundCandidate[] = [
  { className: 'text-slate-900', color: TAILWIND_COLORS['slate-900'] },
  { className: 'text-slate-100', color: TAILWIND_COLORS['slate-100'] },
  { className: 'text-white', color: TAILWIND_COLORS.white },
];

function luminance(hexLike: string): number | null {
  const c = parseColor(hexLike);
  if (!c) return null;
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/** Only non-transparent, parseable colors can participate in contrast math. */
function parseOpaqueColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || /^transparent$/i.test(trimmed)) return null;
  const parsed = parseColor(trimmed);
  return parsed && parsed.a > 0 ? trimmed : null;
}

interface UtilityColor {
  className: string;
  color: string;
}

/** Resolves the first `text-*` or `bg-*` Tailwind palette utility in a class list. */
function utilityColor(classes: string[], prefix: 'text' | 'bg'): UtilityColor | null {
  for (const className of classes) {
    const color = tailwindColorForClass(className, prefix);
    if (color && parseOpaqueColor(color)) return { className, color };
  }
  return null;
}

function fontSizeForTag(decls: Map<string, string>, classes: string[]): number | null {
  const inline = parseFontSizePx(decls.get('font-size'));
  if (inline !== null) return inline;
  for (const className of classes) {
    const size = tailwindFontSizeForClass(className);
    if (size !== null) return size;
  }
  return null;
}

function fontWeightForTag(decls: Map<string, string>, classes: string[]): number | null {
  const inline = decls.get('font-weight');
  if (inline) {
    const numeric = Number(inline);
    if (Number.isFinite(numeric)) return numeric;
    const named = TAILWIND_FONT_WEIGHTS[inline.toLowerCase()];
    if (named !== undefined) return named;
  }
  for (const className of classes) {
    const weight = tailwindFontWeightForClass(className);
    if (weight !== null) return weight;
  }
  return null;
}

function requiredContrast(fontSize: number | null, fontWeight: number | null): number {
  return isLargeText(fontSize, fontWeight) ? AA_LARGE_TEXT_RATIO : AA_NORMAL_TEXT_RATIO;
}

function contrastFails(foreground: string, background: string, required: number): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio !== null && ratio < required;
}

function pickAccessibleForeground(background: string, required: number): ForegroundCandidate {
  const lum = luminance(background);
  const candidates = lum !== null && lum < 0.5
    ? DARK_FOREGROUND_CANDIDATES
    : LIGHT_FOREGROUND_CANDIDATES;

  let best = candidates[0];
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate.color, background) ?? 0;
    if (ratio >= required) return candidate;
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}

function accessibleNameFromContext(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower.startsWith('<input')) {
    const type = (getAttr(tag, 'type') ?? 'text').toLowerCase();
    const placeholder = getAttr(tag, 'placeholder');
    if (placeholder) return placeholder.trim();
    if (type === 'email') return 'Email address';
    if (type === 'password') return 'Password';
    if (type === 'search') return 'Search';
    return 'Input';
  }
  if (lower.startsWith('<select')) return 'Select an option';
  if (lower.startsWith('<textarea')) return getAttr(tag, 'placeholder')?.trim() || 'Message';
  if (lower.startsWith('<button')) return 'Action button';
  if (lower.startsWith('<a')) return 'View details';
  return 'Accessible name';
}

/** Adds programmatic labels to inputs, selects and textareas that have none. */
function fixFormLabels(html: string): string {
  let fieldCount = 0;
  return html.replace(/<(input|select|textarea)\b[^>]*>/gi, (tag) => {
    const kind = /^<(\w+)/i.exec(tag)?.[1].toLowerCase() ?? 'input';
    if (kind === 'input') {
      const type = (getAttr(tag, 'type') ?? 'text').toLowerCase();
      if (['hidden', 'submit', 'reset', 'button', 'image'].includes(type)) return tag;
    }
    const hasAria =
      (getAttr(tag, 'aria-label') ?? '').trim() || (getAttr(tag, 'aria-labelledby') ?? '').trim();
    const id = getAttr(tag, 'id');
    if (hasAria) return tag;
    if (
      id &&
      new RegExp(`<label\\b[^>]*for\\s*=\\s*["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html)
    ) {
      return tag;
    }

    fieldCount += 1;
    const fieldId = id || `a11y-input-${fieldCount}`;
    let next = tag;
    if (!id) next = setOrAddAttr(next, 'id', fieldId);
    if (kind === 'input' && !getAttr(next, 'name')) next = setOrAddAttr(next, 'name', fieldId);
    const labelText = accessibleNameFromContext(tag);
    const label = `<label for="${escapeHtmlAttr(fieldId)}" class="sr-only">${escapeHtmlAttr(labelText)}</label>\n`;
    return label + next;
  });
}

function fixDuplicateIds(html: string): string {
  const seen = new Map<string, number>();
  return html.replace(/<([a-zA-Z][\w:-]*)\b[^>]*\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/g, (tag, _name, dq?: string, sq?: string, bare?: string) => {
    const id = dq ?? sq ?? bare ?? '';
    if (!id) return tag;
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    if (count === 1) return tag;
    return setOrAddAttr(tag, 'id', `${id}-${count}`);
  });
}

function fixAriaAttributes(html: string): string {
  const validAria = new Set([
    'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden', 'aria-live', 'aria-expanded',
    'aria-controls', 'aria-pressed', 'aria-selected', 'aria-checked', 'aria-disabled', 'aria-required',
    'aria-invalid', 'aria-modal', 'aria-current', 'aria-haspopup', 'aria-level', 'aria-orientation',
    'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-busy', 'aria-atomic',
    'aria-roledescription', 'aria-placeholder', 'aria-readonly', 'aria-multiline', 'aria-colspan',
    'aria-rowspan', 'aria-sort', 'aria-posinset', 'aria-setsize', 'aria-activedescendant',
  ]);

  let out = html.replace(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g, (full, tagName: string, attrs: string) => {
    let next = full;
    const attrPattern = /\s(aria-[a-z0-9-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi;
    let match: RegExpExecArray | null;
    while ((match = attrPattern.exec(attrs)) !== null) {
      const attr = match[1].toLowerCase();
      if (!validAria.has(attr)) next = removeAttr(next, attr);
    }

    const role = (getAttr(next, 'role') ?? '').toLowerCase();
    if (role === 'checkbox' && !next.match(/\baria-checked\s*=/i)) next = setOrAddAttr(next, 'aria-checked', 'false');
    if (role === 'slider') {
      if (!next.match(/\baria-valuenow\s*=/i)) next = setOrAddAttr(next, 'aria-valuenow', '0');
      if (!next.match(/\baria-valuemin\s*=/i)) next = setOrAddAttr(next, 'aria-valuemin', '0');
      if (!next.match(/\baria-valuemax\s*=/i)) next = setOrAddAttr(next, 'aria-valuemax', '100');
    }
    if (/^input$/i.test(tagName) && (getAttr(next, 'aria-required') ?? '').toLowerCase() === 'true' && !getAttr(next, 'required')) {
      next = setOrAddAttr(next, 'required', '');
    }
    return next;
  });

  return out;
}

function fixMetaViewport(html: string): string {
  return html.replace(/<meta\b[^>]*\bname\s*=\s*(?:"viewport"|'viewport'|viewport)[^>]*>/gi, (tag) => {
    let next = setOrAddAttr(tag, 'content', VIEWPORT_CONTENT);
    next = removeAttr(next, 'maximum-scale');
    next = removeAttr(next, 'user-scalable');
    return next;
  });
}

function fixFrameTitles(html: string): string {
  let frameCount = 0;
  return html.replace(/<(iframe|frame)\b[^>]*>/gi, (tag) => {
    const title = (getAttr(tag, 'title') ?? '').trim();
    const aria = (getAttr(tag, 'aria-label') ?? '').trim();
    if (title || aria) return tag;
    frameCount += 1;
    return setOrAddAttr(tag, 'title', frameCount === 1 ? 'Embedded content' : `Embedded content ${frameCount}`);
  });
}

function fixListStructure(html: string): string {
  let out = html.replace(/<(ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tagName: string, attrs: string, inner: string) => {
    const hasListItem = /<li\b/i.test(inner);
    if (hasListItem) return full;
    const text = stripTags(inner);
    if (!text) return full;
    return `<${tagName}${attrs}><li>${text}</li></${tagName}>`;
  });

  out = out.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (full, _attrs: string, _inner: string, offset: number) => {
    const before = out.slice(0, offset);
    const lastUl = before.lastIndexOf('<ul');
    const lastOl = before.lastIndexOf('<ol');
    const lastList = Math.max(lastUl, lastOl);
    const lastClose = Math.max(before.lastIndexOf('</ul>'), before.lastIndexOf('</ol>'));
    if (lastList > lastClose) return full;
    return `<ul>${full}</ul>`;
  });
  return out;
}

function shortenContext(value: string, maxWords = 9): string {
  const clean = stripTags(value);
  if (!clean) return '';
  const words = clean.split(' ');
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}…` : clean;
}

/**
 * Derives a meaningful link name from the nearest preceding heading, card
 * caption, or (as a last resort) the link's own href.
 */
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

/**
 * Names unnamed buttons/links and replaces vague anchor text ("Learn more",
 * "Click here", ...) with a context-derived, descriptive accessible name.
 */
function fixButtonsAndLinks(html: string): { html: string; changedRules: Set<string> } {
  const changedRules = new Set<string>();

  let out = html.replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (full, attrs: string, inner: string) => {
    const tag = `<button${attrs}>`;
    const ariaLabel = (getAttr(tag, 'aria-label') ?? '').trim();
    const labelledBy = (getAttr(tag, 'aria-labelledby') ?? '').trim();
    const visibleText = stripTags(inner);

    if (labelledBy) return full;
    if (ariaLabel && hasReadableWords(ariaLabel)) return full;
    if (hasReadableWords(visibleText)) return full;

    const label = accessibleControlLabel(tag, inner);
    changedRules.add('accessible-name');
    return `${setOrAddAttr(tag, 'aria-label', label)}${inner}</button>`;
  });

  out = out.replace(
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
        changedRules.add('vague-link-text');
        const nextTag = setOrAddAttr(tag, 'aria-label', label);
        // Keep nested markup (icons, spans) intact; only replace plain text.
        const nextInner = /<[a-z][\w:-]*\b/i.test(inner) ? inner : label;
        return `${nextTag}${nextInner}</a>`;
      }

      if (ariaLabel && hasReadableWords(ariaLabel)) return full;
      if (hasReadableWords(visibleText)) return full;

      const label = accessibleControlLabel(tag, inner);
      changedRules.add('accessible-name');
      return `${setOrAddAttr(tag, 'aria-label', label)}${inner}</a>`;
    },
  );

  return { html: out, changedRules };
}

function fixImageAlts(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\balt\s*=/.test(tag)) return tag;
    if (/\brole\s*=\s*["'](?:presentation|none)["']/i.test(tag)) return tag;
    const src = getAttr(tag, 'src') ?? '';
    let alt = 'Descriptive image';
    try {
      const file = src.split('/').pop()?.split('?')[0] ?? '';
      const words = file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
      if (words && words.length >= 3 && !/^[0-9a-f]+$/i.test(words)) alt = words;
    } catch { /* ignore */ }
    if (/unsplash/i.test(src)) alt = 'Team collaborating in an office';
    return setOrAddAttr(tag, 'alt', alt);
  });
}

/** Rewrites any positive tabindex to the natural-order value zero. */
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

/**
 * Removes outline suppression (inline or utility class) and installs an
 * explicit :focus-visible outline so keyboard focus stays perceivable.
 */
function fixFocusOutline(html: string): string {
  return html.replace(/<([a-zA-Z][\w:-]*)\b[^>]*>/g, (tag) => {
    const rawClasses = (getAttr(tag, 'class') ?? '').split(/\s+/).filter(Boolean);
    const suppressedClasses = rawClasses.filter((className) =>
      /^(?:[a-z-]+:)?outline-(?:none|0)$/i.test(className),
    );

    const decls = parseInlineStyle(getAttr(tag, 'style') ?? '');
    const outline = (decls.get('outline') ?? decls.get('outline-style') ?? '').trim();
    const inlineSuppressed = /^none$/i.test(outline) || /^0(?:\s+none)?$/i.test(outline);
    if (suppressedClasses.length === 0 && !inlineSuppressed) return tag;

    let next = tag;
    if (suppressedClasses.length > 0) {
      const kept = rawClasses.filter((className) => !suppressedClasses.includes(className));
      next = setOrAddAttr(next, 'class', kept.join(' '));
    }
    if (inlineSuppressed) {
      decls.delete('outline');
      decls.delete('outline-style');
      const serialized = serializeInlineStyle(decls);
      next = serialized ? setOrAddAttr(next, 'style', serialized) : removeAttr(next, 'style');
    }

    const classes = (getAttr(next, 'class') ?? '').split(/\s+/).filter(Boolean);
    for (const className of FOCUS_OUTLINE_CLASSES) {
      if (!classes.includes(className)) classes.push(className);
    }
    return setOrAddAttr(next, 'class', classes.join(' '));
  });
}

interface ContrastFrame {
  tag: string;
  background: string | null;
  foreground: string | null;
  fontSize: number | null;
  fontWeight: number | null;
}

/**
 * Repairs failing foreground/background pairs after all structural transforms
 * have run (including `h3` -> `h2` heading normalization). Resolves Tailwind
 * color utilities, inline styles and inherited colors/backgrounds so mid-slate
 * text on dark panels is replaced with an AA-compliant high-contrast shade.
 */
function fixContrastInHtml(html: string): string {
  const pattern = /<(\/)?([a-zA-Z][\w:-]*)\b([^>]*)>/g;
  const stack: ContrastFrame[] = [];
  let output = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const full = match[0];
    const isClosing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    const attrs = match[3];
    output += html.slice(cursor, match.index);

    if (isClosing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      output += full;
      cursor = match.index + full.length;
      continue;
    }

    const parent = stack[stack.length - 1] ?? null;
    const selfClosing = /\/\s*$/.test(attrs) || VOID_TAGS.has(tag);
    const classes = (getAttr(full, 'class') ?? '').split(/\s+/).filter(Boolean);
    const decls = parseInlineStyle(getAttr(full, 'style') ?? '');

    const ownBackground = parseOpaqueColor(decls.get('background-color') ?? decls.get('background'))
      ?? utilityColor(classes, 'bg')?.color
      ?? null;
    const background = ownBackground ?? parent?.background ?? '#ffffff';

    const inlineForeground = parseOpaqueColor(decls.get('color'));
    const foregroundUtility = inlineForeground ? null : utilityColor(classes, 'text');
    const utilityForeground = foregroundUtility?.color ?? null;
    const ownForeground = inlineForeground ?? utilityForeground;
    const inheritedForeground = parent?.foreground ?? null;
    const fontSize = fontSizeForTag(decls, classes) ?? parent?.fontSize ?? null;
    const fontWeight = fontWeightForTag(decls, classes) ?? parent?.fontWeight ?? null;
    const required = requiredContrast(fontSize, fontWeight);

    const afterTag = html.slice(match.index + full.length);
    const directText = selfClosing
      ? ''
      : (afterTag.match(/^[^<]*/)?.[0] ?? '').replace(/\s+/g, ' ').trim();
    const checkable = !NON_TEXT_TAGS.has(tag);

    let next = full;
    let effectiveForeground = ownForeground ?? inheritedForeground;

    if (checkable && ownForeground && contrastFails(ownForeground, background, required)) {
      const replacement = pickAccessibleForeground(background, required);
      if (inlineForeground) {
        next = updateInlineStyle(next, (styleDecls) => {
          styleDecls.set('color', replacement.color);
        });
      } else if (utilityForeground) {
        next = setOrAddAttr(
          next,
          'class',
          classes.map((className) => className === foregroundUtility?.className ? replacement.className : className).join(' '),
        );
      }
      effectiveForeground = replacement.color;
    } else if (
      checkable && !ownForeground && directText && !UA_BACKGROUND_TAGS.has(tag) &&
      contrastFails(inheritedForeground ?? '#000000', background, required)
    ) {
      // A child on a different backdrop inherits a failing color from above (or
      // falls back to the browser's default black text on a dark backdrop).
      const replacement = pickAccessibleForeground(background, required);
      const merged = classes.includes(replacement.className) ? classes : [...classes, replacement.className];
      next = setOrAddAttr(next, 'class', merged.join(' '));
      effectiveForeground = replacement.color;
    }

    output += next;
    cursor = match.index + full.length;

    if (!selfClosing) {
      stack.push({ tag, background, foreground: effectiveForeground, fontSize, fontWeight });
    }
  }

  output += html.slice(cursor);
  return output;
}

export async function createDemoFix(request: AiFixRequest): Promise<AiFixResult> {
  const before = request.snippet.html;
  let patched = before;
  const appliedRules = new Set<string>();
  const mark = (rule: string, beforeRule: string, afterRule: string) => {
    if (afterRule !== beforeRule) appliedRules.add(rule);
  };

  const afterAlt = fixImageAlts(patched); mark('image-alt', patched, afterAlt); patched = afterAlt;
  const afterLabels = fixFormLabels(patched); mark('form-label', patched, afterLabels); patched = afterLabels;
  const afterNames = fixButtonsAndLinks(patched);
  if (afterNames.html !== patched) {
    patched = afterNames.html;
    for (const rule of afterNames.changedRules) appliedRules.add(rule);
  }
  const afterHeadings = normalizeHeadingOrder(patched); mark('heading-order', patched, afterHeadings); patched = afterHeadings;
  const afterTabindex = fixPositiveTabindex(patched); mark('positive-tabindex', patched, afterTabindex); patched = afterTabindex;
  const afterFocus = fixFocusOutline(patched); mark('focus-outline', patched, afterFocus); patched = afterFocus;
  const afterDuplicateIds = fixDuplicateIds(patched); mark('duplicate-id', patched, afterDuplicateIds); patched = afterDuplicateIds;
  const afterAria = fixAriaAttributes(patched);
  if (afterAria !== patched) {
    appliedRules.add('aria-valid-attr');
    appliedRules.add('aria-required-attr');
    patched = afterAria;
  }
  const afterMeta = fixMetaViewport(patched); mark('meta-viewport', patched, afterMeta); patched = afterMeta;
  const afterFrames = fixFrameTitles(patched); mark('frame-title', patched, afterFrames); patched = afterFrames;
  const afterLists = fixListStructure(patched);
  if (afterLists !== patched) {
    appliedRules.add('list');
    appliedRules.add('listitem');
    patched = afterLists;
  }
  const afterContrast = fixContrastInHtml(patched); mark('color-contrast', patched, afterContrast); patched = afterContrast;

  const warnings: string[] = [];
  if (patched === before) warnings.push('No deterministic demo changes were needed for the selected issues.');
  warnings.push('Demo mode uses deterministic heuristics. For nuanced refactors, configure OpenRouter or Ollama.');

  const appliedIssueIds = request.issues.filter((issue) => {
    const mapped = DEMO_RULE_HANDLERS[issue.ruleId] ?? issue.ruleId;
    return appliedRules.has(mapped);
  }).map((issue) => issue.id);

  const summaryParts: string[] = [];
  if (appliedRules.has('image-alt')) summaryParts.push('added missing image alt text');
  if (appliedRules.has('accessible-name')) summaryParts.push('added accessible names/labels');
  if (appliedRules.has('form-label')) summaryParts.push('labeled form controls');
  if (appliedRules.has('heading-order')) summaryParts.push('corrected heading level order');
  if (appliedRules.has('vague-link-text')) summaryParts.push('rewrote vague link text');
  if (appliedRules.has('positive-tabindex')) summaryParts.push('normalized positive tabindex values');
  if (appliedRules.has('focus-outline')) summaryParts.push('restored visible focus outlines');
  if (appliedRules.has('duplicate-id')) summaryParts.push('removed duplicate IDs');
  if (appliedRules.has('aria-valid-attr') || appliedRules.has('aria-required-attr')) summaryParts.push('fixed ARIA attributes');
  if (appliedRules.has('meta-viewport')) summaryParts.push('fixed viewport scaling');
  if (appliedRules.has('frame-title')) summaryParts.push('added frame titles');
  if (appliedRules.has('list') || appliedRules.has('listitem')) summaryParts.push('repaired list structure');
  if (appliedRules.has('color-contrast')) summaryParts.push('improved text color contrast');

  return {
    providerId: 'demo',
    generatedAt: new Date().toISOString(),
    summary: summaryParts.length ? `Demo fix: ${summaryParts.join(', ')}.` : 'Demo fix: no automatic changes applied.',
    patchedHtml: patched,
    diff: buildDiff(before, patched),
    warnings,
    appliedIssueIds,
  };
}

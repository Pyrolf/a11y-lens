import type { CodeSnippet } from '../../types/editor';
import type {
  ComputedStyleEntry,
} from '../../types/audit';
import type {
  DesignToken,
  TokenExtractionResult,
  TokenKind,
  TokenOrigin,
  TokenSource,
} from '../../types/tokens';
import { hasOpaqueColor, toHexColor } from '../../utils/colorMath';
import {
  collectCssVariables,
  parseInlineDeclarations,
  resolveCssVariables,
  TAILWIND_COLORS,
  TAILWIND_FONT_SIZES,
  TAILWIND_RADIUS,
  TAILWIND_SHADOWS,
  TAILWIND_SPACING,
} from '../../utils/styleResolver';

const MAX_USAGE_EXAMPLES = 3;
const EXCLUDED_TAGS = new Set(['script', 'style', 'template']);

const PROPERTY_KINDS: Record<string, TokenKind> = {
  color: 'color',
  background: 'color',
  'background-color': 'color',
  'border-color': 'color',
  'border-top-color': 'color',
  'border-right-color': 'color',
  'border-bottom-color': 'color',
  'border-left-color': 'color',
  'font-family': 'font-family',
  'font-size': 'font-size',
  'font-weight': 'other',
  padding: 'spacing',
  'padding-top': 'spacing',
  'padding-right': 'spacing',
  'padding-bottom': 'spacing',
  'padding-left': 'spacing',
  margin: 'spacing',
  'margin-top': 'spacing',
  'margin-right': 'spacing',
  'margin-bottom': 'spacing',
  'margin-left': 'spacing',
  gap: 'spacing',
  'row-gap': 'spacing',
  'column-gap': 'spacing',
  width: 'spacing',
  height: 'spacing',
  'border-radius': 'radius',
  'box-shadow': 'shadow',
};

/**
 * Color properties are handled separately so computed rgb() values become
 * clean, de-duplicated `Text Color` / `Background Color` tokens. The effective
 * background remains internal to WCAG contrast math and is never emitted as a
 * fake background token.
 */
const COMPUTED_PROPERTIES = [
  'font-size',
  'font-weight',
  'font-family',
  'padding',
  'border-radius',
] as const;

const SPACING_PREFIXES = new Set([
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml',
  'gap', 'gap-x', 'gap-y', 'w', 'h', 'size',
]);

interface AddTokenOptions {
  /** Canonical CSS property used for `(origin, property, value)` de-duplication. */
  property?: string;
  origin?: TokenOrigin;
  originalValue?: string;
}

type AddToken = (
  name: string,
  value: string,
  kind: TokenKind,
  source: TokenSource,
  example: string,
  options?: AddTokenOptions,
) => void;

function inferKind(name: string, value: string): TokenKind {
  if (parseColorForKind(value)) return 'color';
  if (/font|family|sans|serif|mono/i.test(name) || value.includes(',')) return 'font-family';
  if (/size/i.test(name) && /^\d/.test(value.trim())) return 'font-size';
  if (/radius|rounded|corner/i.test(name)) return 'radius';
  if (/shadow/i.test(name)) return 'shadow';
  if (/^-?\d*\.?\d+(px|rem|em|%|vw|vh)?$/i.test(value.trim())) return 'spacing';
  return 'other';
}

/** `inferKind` only needs to know whether a value is a color, not its channels. */
function parseColorForKind(value: string): boolean {
  return hasOpaqueColor(value) || /^(?:transparent|#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(value.trim());
}

function normalizeValue(kind: TokenKind, rawValue: string): string {
  const value = rawValue.trim();
  if (kind === 'color') {
    const hex = toHexColor(value);
    if (hex) return hex;
  }
  if ((kind === 'spacing' || kind === 'radius') && /^-?\d*\.?\d+$/.test(value)) {
    return `${value}px`;
  }
  return value;
}

/** Shorthand declarations are stored under their computed property name. */
function canonicalProperty(property: string): string {
  const normalized = property.trim().toLowerCase();
  return normalized === 'background' ? 'background-color' : normalized;
}

/** Maps a Tailwind utility to the CSS property it explicitly declares. */
function authoredPropertyForTailwindClass(className: string, kind: TokenKind): string {
  const base = className.replace(/^.*:/, '');
  const prefix = base.slice(0, base.indexOf('-'));

  if (prefix === 'bg') return 'background-color';
  if (prefix === 'border' || prefix === 'from' || prefix === 'via' || prefix === 'to') {
    return 'border-color';
  }
  if (prefix === 'text') return kind === 'font-size' ? 'font-size' : 'color';
  if (prefix === 'font') return kind === 'font-family' ? 'font-family' : 'font-weight';
  if (prefix === 'rounded') return 'border-radius';
  if (prefix === 'shadow') return 'box-shadow';
  if (SPACING_PREFIXES.has(prefix)) {
    if (prefix.startsWith('p')) return 'padding';
    if (prefix.startsWith('m')) return 'margin';
    if (prefix === 'gap' || prefix === 'gap-x' || prefix === 'gap-y') return 'gap';
    if (prefix === 'w' || prefix === 'size') return 'width';
    if (prefix === 'h') return 'height';
  }
  return base;
}

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = Array.from(element.classList)
    .slice(0, 2)
    .map((className) => `.${className}`)
    .join('');
  return `<${tag}${id}${classes}>`;
}

function describeComputedEntry(entry: ComputedStyleEntry): string {
  const id = entry.id ? `#${entry.id}` : '';
  const classes = entry.className
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((className) => `.${className}`)
    .join('');
  return `<${entry.tag}${id}${classes}>`;
}

function snippetElements(snippetDocument: Document): Element[] {
  return Array.from(snippetDocument.body.querySelectorAll('*')).filter(
    (element) => !EXCLUDED_TAGS.has(element.tagName.toLowerCase()),
  );
}

/** The iframe snapshot and the snippet DOM are in the same document order. */
function matchSnippetElement(
  entry: ComputedStyleEntry,
  elements: Element[],
  index: number,
): Element | null {
  const candidate = elements[index];
  if (candidate && candidate.tagName.toLowerCase() === (entry.tag ?? '').toLowerCase()) {
    return candidate;
  }
  const descriptor = describeComputedEntry(entry);
  return elements.find((element) => describeElement(element) === descriptor) ?? null;
}

/** CSS properties explicitly declared on one element by inline styles/Tailwind. */
function authoredPropertiesFor(element: Element | null): Set<string> {
  const properties = new Set<string>();
  if (!element) return properties;

  for (const property of parseInlineDeclarations(element.getAttribute('style')).keys()) {
    if (property.startsWith('--')) continue;
    properties.add(canonicalProperty(property));
  }
  for (const className of Array.from(element.classList)) {
    const tailwindToken = parseTailwindClass(className);
    if (tailwindToken) {
      properties.add(authoredPropertyForTailwindClass(className, tailwindToken.kind));
    }
  }
  return properties;
}

function parseTailwindClass(
  className: string,
): { name: string; value: string; kind: TokenKind } | null {
  const arbitrary = /^([a-z-]+)-\[(.+)\]$/.exec(className);
  if (arbitrary) {
    const [, prefix, rawValue] = arbitrary;
    let kind: TokenKind;
    if (prefix === 'text') {
      kind = parseColorForKind(rawValue) ? 'color' : 'font-size';
    } else if (prefix === 'font') {
      kind = rawValue.includes(',') ? 'font-family' : 'font-size';
    } else {
      kind = inferKind(prefix, rawValue);
    }
    return { name: prefix, value: rawValue, kind };
  }

  const separator = className.indexOf('-');
  if (separator < 0) return null;
  const prefix = className.slice(0, separator);
  const scale = className.slice(separator + 1);
  if (!scale) return null;

  if (prefix === 'text' && TAILWIND_FONT_SIZES[scale]) {
    return { name: className, value: TAILWIND_FONT_SIZES[scale], kind: 'font-size' };
  }
  if (['bg', 'text', 'border', 'from', 'via', 'to'].includes(prefix) && TAILWIND_COLORS[scale]) {
    return { name: className, value: TAILWIND_COLORS[scale], kind: 'color' };
  }
  if (SPACING_PREFIXES.has(prefix) && TAILWIND_SPACING[scale]) {
    return { name: className, value: TAILWIND_SPACING[scale], kind: 'spacing' };
  }
  if (prefix === 'rounded' && TAILWIND_RADIUS[scale]) {
    return { name: className, value: TAILWIND_RADIUS[scale], kind: 'radius' };
  }
  if (prefix === 'shadow' && TAILWIND_SHADOWS[scale]) {
    return { name: className, value: TAILWIND_SHADOWS[scale], kind: 'shadow' };
  }
  return null;
}

function isTransparentColorValue(value: string, variables: Map<string, string>): boolean {
  const resolved = value.includes('var(') ? resolveCssVariables(value, variables) : value;
  return !hasOpaqueColor(resolved);
}

function recordDeclarations(
  declarations: string | null | undefined,
  source: TokenSource,
  example: string,
  variables: Map<string, string>,
  addToken: AddToken,
): void {
  for (const [property, rawValue] of parseInlineDeclarations(declarations)) {
    const canonical = canonicalProperty(property);
    if (property.startsWith('--')) {
      const name = property.slice(2);
      const value = variables.get(property) ?? rawValue;
      const kind = inferKind(name, value);
      if (kind === 'color' && isTransparentColorValue(value, variables)) continue;
      addToken(name, value, kind, 'css-variable', example, {
        property,
        origin: 'authored',
      });
      continue;
    }

    const kind = PROPERTY_KINDS[property];
    if (!kind) continue;
    // Transparent fills are layout noise, not design tokens.
    if (kind === 'color' && isTransparentColorValue(rawValue, variables)) continue;
    addToken(property, rawValue, kind, source, example, {
      property: canonical,
      origin: 'authored',
    });

    // Preserve both the authored var() and its resolved, comparable value.
    if (rawValue.includes('var(')) {
      const resolved = resolveCssVariables(rawValue, variables).trim();
      if (resolved && resolved !== rawValue) {
        addToken(`${property} (resolved)`, resolved, kind, 'css-variable', example, {
          property: canonical,
          origin: 'authored',
        });
      }
    }
  }
}

/**
 * Records one unique, human-readable color token per origin + property + hex.
 * Multiple elements sharing a value increment the same token's `occurrences`
 * count, which the UI renders as an "N elements" usage badge.
 */
function recordComputedColor(
  raw: string | null | undefined,
  name: 'Text Color' | 'Background Color',
  property: string,
  origin: TokenOrigin,
  example: string,
  addToken: AddToken,
): void {
  if (!raw || !hasOpaqueColor(raw)) return;
  const hex = toHexColor(raw);
  if (!hex) return;
  const trimmed = raw.trim();
  addToken(name, hex, 'color', 'computed-style', example, {
    property,
    origin,
    originalValue: trimmed,
  });
}

/**
 * Extracts design tokens from the user's snippet only. The source pass reads
 * explicit declarations from the snippet DOM (Tailwind utilities, `var(--*)`
 * and inline styles) and tags them `origin: 'authored'`. The computed pass
 * consumes the iframe's postMessage snapshot (already restricted to
 * `iframeDoc.body.querySelectorAll('*')` with script/style/template excluded)
 * and tags each value by whether that property was explicitly declared on the
 * element (`authored`) or inherited/browser-default (`inherited`). Tokens are
 * de-duplicated by `(origin, canonical property, normalized value)`.
 *
 * The Extracted Tokens panel renders only `origin: 'authored'` tokens. The
 * WCAG contrast audit is a separate pass over the full computed-style snapshot,
 * so inherited/browser-default values still surface as Audit Report issues.
 */
export function extractTokens(
  snippet: CodeSnippet,
  computedStyles: ComputedStyleEntry[] = [],
): TokenExtractionResult {
  const tokens = new Map<string, DesignToken>();

  const addToken: AddToken = (name, value, kind, source, example, options = {}) => {
    const normalizedValue = normalizeValue(kind, value);
    const origin = options.origin ?? 'authored';
    const inherited = origin === 'inherited';
    const property = options.property ?? name;
    // Colors are displayed as canonical uppercase hex, never as raw rgb().
    const displayValue = kind === 'color' && normalizedValue ? normalizedValue : value.trim();
    const id = `${origin}:${property}:${normalizedValue}`;
    const existing = tokens.get(id);
    if (existing) {
      existing.occurrences += 1;
      if (
        !existing.originalValue &&
        options.originalValue &&
        options.originalValue !== displayValue
      ) {
        existing.originalValue = options.originalValue;
      }
      if (
        example &&
        existing.usageExamples.length < MAX_USAGE_EXAMPLES &&
        !existing.usageExamples.includes(example)
      ) {
        existing.usageExamples.push(example);
      }
      return;
    }
    tokens.set(id, {
      id,
      kind,
      name,
      value: displayValue,
      originalValue: options.originalValue,
      source,
      origin,
      inherited,
      occurrences: 1,
      usageExamples: example ? [example] : [],
    });
  };

  const snippetDocument = new DOMParser().parseFromString(snippet.html, 'text/html');
  const variables = collectCssVariables(snippetDocument);

  for (const style of Array.from(snippetDocument.querySelectorAll('style'))) {
    if (style.hasAttribute('data-a11y-lens-sandbox')) continue;
    recordDeclarations(style.textContent ?? '', 'css-variable', '<style>', variables, addToken);
  }

  const elements = snippetElements(snippetDocument);
  for (const element of elements) {
    const example = describeElement(element);
    recordDeclarations(element.getAttribute('style'), 'inline-style', example, variables, addToken);

    for (const className of Array.from(element.classList)) {
      const tailwindToken = parseTailwindClass(className);
      if (tailwindToken) {
        addToken(
          tailwindToken.name,
          tailwindToken.value,
          tailwindToken.kind,
          'tailwind-class',
          example,
          {
            property: authoredPropertyForTailwindClass(className, tailwindToken.kind),
            origin: 'authored',
          },
        );
      }
    }
  }

  // Real computed styles posted by the sandboxed iframe. Text/background
  // colors are clean, unique tokens; `effectiveBackground` stays internal.
  for (let index = 0; index < computedStyles.length; index += 1) {
    const entry = computedStyles[index];
    if (EXCLUDED_TAGS.has((entry.tag ?? '').toLowerCase())) continue;
    const example = describeComputedEntry(entry);
    const authoredProperties = authoredPropertiesFor(matchSnippetElement(entry, elements, index));

    recordComputedColor(
      entry.styles?.color,
      'Text Color',
      'color',
      authoredProperties.has('color') ? 'authored' : 'inherited',
      example,
      addToken,
    );
    recordComputedColor(
      entry.styles?.['background-color'] || entry.styles?.background,
      'Background Color',
      'background-color',
      authoredProperties.has('background-color') ? 'authored' : 'inherited',
      example,
      addToken,
    );

    for (const property of COMPUTED_PROPERTIES) {
      const value = entry.styles?.[property];
      if (value) {
        addToken(
          property,
          value,
          PROPERTY_KINDS[property] ?? inferKind(property, value),
          'computed-style',
          example,
          {
            property,
            origin: authoredProperties.has(property) ? 'authored' : 'inherited',
          },
        );
      }
    }
  }

  return {
    snippetId: snippet.id,
    extractedAt: new Date().toISOString(),
    tokens: Array.from(tokens.values()),
    warnings: [],
  };
}

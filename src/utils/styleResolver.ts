/**
 * Mapping utilities shared by the iframe-backed token extractor and the
 * deterministic auditor. This module never touches the real DOM's styles; it
 * resolves source-level declarations (Tailwind utilities, `var(--…)`, inline
 * CSS) into concrete CSS values that the color math can consume.
 */

import { hasOpaqueColor } from './colorMath';

/** Standard Tailwind palette (all 11 shades for the default color families). */
export const TAILWIND_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: '#00000000',
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',
  'slate-950': '#020617',
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  'gray-950': '#030712',
  'zinc-50': '#fafafa',
  'zinc-100': '#f4f4f5',
  'zinc-200': '#e4e4e7',
  'zinc-300': '#d4d4d8',
  'zinc-400': '#a1a1aa',
  'zinc-500': '#71717a',
  'zinc-600': '#52525b',
  'zinc-700': '#3f3f46',
  'zinc-800': '#27272a',
  'zinc-900': '#18181b',
  'zinc-950': '#09090b',
  'neutral-50': '#fafafa',
  'neutral-100': '#f5f5f5',
  'neutral-200': '#e5e5e5',
  'neutral-300': '#d4d4d4',
  'neutral-400': '#a3a3a3',
  'neutral-500': '#737373',
  'neutral-600': '#525252',
  'neutral-700': '#404040',
  'neutral-800': '#262626',
  'neutral-900': '#171717',
  'neutral-950': '#0a0a0a',
  'stone-50': '#fafaf9',
  'stone-100': '#f5f5f4',
  'stone-200': '#e7e5e4',
  'stone-300': '#d6d3d1',
  'stone-400': '#a8a29e',
  'stone-500': '#78716c',
  'stone-600': '#57534e',
  'stone-700': '#44403c',
  'stone-800': '#292524',
  'stone-900': '#1c1917',
  'stone-950': '#0c0a09',
  'red-50': '#fef2f2',
  'red-100': '#fee2e2',
  'red-200': '#fecaca',
  'red-300': '#fca5a5',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'red-800': '#991b1b',
  'red-900': '#7f1d1d',
  'red-950': '#450a0a',
  'orange-50': '#fff7ed',
  'orange-100': '#ffedd5',
  'orange-200': '#fed7aa',
  'orange-300': '#fdba74',
  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  'orange-700': '#c2410c',
  'orange-800': '#9a3412',
  'orange-900': '#7c2d12',
  'orange-950': '#431407',
  'amber-50': '#fffbeb',
  'amber-100': '#fef3c7',
  'amber-200': '#fde68a',
  'amber-300': '#fcd34d',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'amber-700': '#b45309',
  'amber-800': '#92400e',
  'amber-900': '#78350f',
  'amber-950': '#451a03',
  'yellow-50': '#fefce8',
  'yellow-100': '#fef9c3',
  'yellow-200': '#fef08a',
  'yellow-300': '#fde047',
  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'yellow-600': '#ca8a04',
  'yellow-700': '#a16207',
  'yellow-800': '#854d0e',
  'yellow-900': '#713f12',
  'yellow-950': '#422006',
  'lime-50': '#f7fee7',
  'lime-100': '#ecfccb',
  'lime-200': '#d9f99d',
  'lime-300': '#bef264',
  'lime-400': '#a3e635',
  'lime-500': '#84cc16',
  'lime-600': '#65a30d',
  'lime-700': '#4d7c0f',
  'lime-800': '#3f6212',
  'lime-900': '#365314',
  'lime-950': '#1a2e05',
  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-200': '#bbf7d0',
  'green-300': '#86efac',
  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'green-800': '#166534',
  'green-900': '#14532d',
  'green-950': '#052e16',
  'emerald-50': '#ecfdf5',
  'emerald-100': '#d1fae5',
  'emerald-200': '#a7f3d0',
  'emerald-300': '#6ee7b7',
  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  'emerald-700': '#047857',
  'emerald-800': '#065f46',
  'emerald-900': '#064e3b',
  'emerald-950': '#022c22',
  'teal-50': '#f0fdfa',
  'teal-100': '#ccfbf1',
  'teal-200': '#99f6e4',
  'teal-300': '#5eead4',
  'teal-400': '#2dd4bf',
  'teal-500': '#14b8a6',
  'teal-600': '#0d9488',
  'teal-700': '#0f766e',
  'teal-800': '#115e59',
  'teal-900': '#134e4a',
  'teal-950': '#042f2e',
  'cyan-50': '#ecfeff',
  'cyan-100': '#cffafe',
  'cyan-200': '#a5f3fc',
  'cyan-300': '#67e8f9',
  'cyan-400': '#22d3ee',
  'cyan-500': '#06b6d4',
  'cyan-600': '#0891b2',
  'cyan-700': '#0e7490',
  'cyan-800': '#155e75',
  'cyan-900': '#164e63',
  'cyan-950': '#083344',
  'sky-50': '#f0f9ff',
  'sky-100': '#e0f2fe',
  'sky-200': '#bae6fd',
  'sky-300': '#7dd3fc',
  'sky-400': '#38bdf8',
  'sky-500': '#0ea5e9',
  'sky-600': '#0284c7',
  'sky-700': '#0369a1',
  'sky-800': '#075985',
  'sky-900': '#0c4a6e',
  'sky-950': '#082f49',
  'blue-50': '#eff6ff',
  'blue-100': '#dbeafe',
  'blue-200': '#bfdbfe',
  'blue-300': '#93c5fd',
  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'blue-800': '#1e40af',
  'blue-900': '#1e3a8a',
  'blue-950': '#172554',
  'indigo-50': '#eef2ff',
  'indigo-100': '#e0e7ff',
  'indigo-200': '#c7d2fe',
  'indigo-300': '#a5b4fc',
  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  'indigo-700': '#4338ca',
  'indigo-800': '#3730a3',
  'indigo-900': '#312e81',
  'indigo-950': '#1e1b4b',
  'violet-50': '#f5f3ff',
  'violet-100': '#ede9fe',
  'violet-200': '#ddd6fe',
  'violet-300': '#c4b5fd',
  'violet-400': '#a78bfa',
  'violet-500': '#8b5cf6',
  'violet-600': '#7c3aed',
  'violet-700': '#6d28d9',
  'violet-800': '#5b21b6',
  'violet-900': '#4c1d95',
  'violet-950': '#2e1065',
  'purple-50': '#faf5ff',
  'purple-100': '#f3e8ff',
  'purple-200': '#e9d5ff',
  'purple-300': '#d8b4fe',
  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'purple-700': '#7e22ce',
  'purple-800': '#6b21a8',
  'purple-900': '#581c87',
  'purple-950': '#3b0764',
  'fuchsia-50': '#fdf4ff',
  'fuchsia-100': '#fae8ff',
  'fuchsia-200': '#f5d0fe',
  'fuchsia-300': '#f0abfc',
  'fuchsia-400': '#e879f9',
  'fuchsia-500': '#d946ef',
  'fuchsia-600': '#c026d3',
  'fuchsia-700': '#a21caf',
  'fuchsia-800': '#86198f',
  'fuchsia-900': '#701a75',
  'fuchsia-950': '#4a044e',
  'pink-50': '#fdf2f8',
  'pink-100': '#fce7f3',
  'pink-200': '#fbcfe8',
  'pink-300': '#f9a8d4',
  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  'pink-600': '#db2777',
  'pink-700': '#be185d',
  'pink-800': '#9d174d',
  'pink-900': '#831843',
  'pink-950': '#500724',
  'rose-50': '#fff1f2',
  'rose-100': '#ffe4e6',
  'rose-200': '#fecdd3',
  'rose-300': '#fda4af',
  'rose-400': '#fb7185',
  'rose-500': '#f43f5e',
  'rose-600': '#e11d48',
  'rose-700': '#be123c',
  'rose-800': '#9f1239',
  'rose-900': '#881337',
  'rose-950': '#4c0519',
};

export const TAILWIND_SPACING: Record<string, string> = {
  '0': '0px',
  px: '1px',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '3.5': '14px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '9': '36px',
  '10': '40px',
  '11': '44px',
  '12': '48px',
  '14': '56px',
  '16': '64px',
  '20': '80px',
  '24': '96px',
  '28': '112px',
  '32': '128px',
  '36': '144px',
  '40': '160px',
  '44': '176px',
  '48': '192px',
  '60': '240px',
  '64': '256px',
  '70': '280px',
  '80': '320px',
  '90': '360px',
  '100': '400px',
  '105': '420px',
};

export const TAILWIND_FONT_SIZES: Record<string, string> = {
  '2xs': '10px',
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
  '5xl': '48px',
  '6xl': '60px',
};

export const TAILWIND_FONT_WEIGHTS: Record<string, number> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

export const TAILWIND_RADIUS: Record<string, string> = {
  sm: '2px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px',
};

export const TAILWIND_SHADOWS: Record<string, string> = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
};

const SPACING_PREFIXES = new Set([
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml',
  'gap', 'gap-x', 'gap-y', 'w', 'h', 'size',
]);

export function parseInlineDeclarations(style: string | null | undefined): Map<string, string> {
  const declarations = new Map<string, string>();
  if (!style) return declarations;
  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (property && value) declarations.set(property, value);
  }
  return declarations;
}

/** Resolves `var(--token, fallback)` references, including nested variables. */
export function resolveCssVariables(
  value: string,
  variables: Map<string, string>,
  seen = new Set<string>(),
): string {
  return value.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/gi,
    (_match, name: string, fallback: string | undefined) => {
      const resolved = variables.get(name);
      if (resolved === undefined || seen.has(name)) return (fallback ?? '').trim();
      const nextSeen = new Set(seen).add(name);
      return resolveCssVariables(resolved, variables, nextSeen).trim();
    },
  );
}

/** Collects custom properties declared in `<style>` blocks and inline styles. */
export function collectCssVariables(doc: Document): Map<string, string> {
  const raw = new Map<string, string>();
  const sources: string[] = [];
  for (const style of Array.from(doc.querySelectorAll('style'))) {
    sources.push(style.textContent ?? '');
  }
  for (const element of Array.from(doc.querySelectorAll('[style]'))) {
    sources.push(element.getAttribute('style') ?? '');
  }
  for (const source of sources) {
    const pattern = /(--[\w-]+)\s*:\s*([^;}]+)/g;
    let match: RegExpExecArray | null = pattern.exec(source);
    while (match !== null) {
      raw.set(match[1], match[2].trim());
      match = pattern.exec(source);
    }
  }
  const resolved = new Map<string, string>();
  for (const [name, value] of raw) {
    resolved.set(name, resolveCssVariables(value, raw).trim());
  }
  return resolved;
}

function applyOpacity(color: string, opacity: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;
  const alpha = Math.round(Math.min(1, Math.max(0, Number(opacity) / 100)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${hex[1]}${alpha}`;
}

/** Returns the concrete color for a `text-*`, `bg-*` or `border-*` utility. */
export function tailwindColorForClass(
  className: string,
  prefix: 'text' | 'bg' | 'border',
): string | null {
  const escaped = className.replace(/^.*:/, '');
  if (!escaped.startsWith(`${prefix}-`)) return null;
  const remainder = escaped.slice(prefix.length + 1);
  const slash = remainder.lastIndexOf('/');
  const scale = slash >= 0 ? remainder.slice(0, slash) : remainder;
  const color = TAILWIND_COLORS[scale];
  if (!color) return null;
  if (slash >= 0) {
    const opacity = remainder.slice(slash + 1);
    if (/^\d+$/.test(opacity)) return applyOpacity(color, opacity);
  }
  return color;
}

export function tailwindFontSizeForClass(className: string): number | null {
  const escaped = className.replace(/^.*:/, '');
  if (!escaped.startsWith('text-')) return null;
  const scale = escaped.slice('text-'.length);
  if (TAILWIND_FONT_SIZES[scale]) return parseFloat(TAILWIND_FONT_SIZES[scale]);
  const arbitrary = /^text-\[(\d*\.?\d+)px\]$/.exec(className.replace(/^.*:/, ''));
  return arbitrary ? Number(arbitrary[1]) : null;
}

export function tailwindFontWeightForClass(className: string): number | null {
  const escaped = className.replace(/^.*:/, '');
  if (!escaped.startsWith('font-')) return null;
  return TAILWIND_FONT_WEIGHTS[escaped.slice('font-'.length)] ?? null;
}

export function parseFontSizePx(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const match = /^(-?\d*\.?\d+)(px|pt|rem|em|%)?$/.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  switch (match[2]) {
    case 'pt': return amount * (4 / 3);
    case 'rem':
    case 'em':
    case '%':
      return amount * 16;
    default: return amount;
  }
}

/** WCAG counts >= 24px as large, or >= 18.66px when bold. */
export function isLargeText(fontSizePx: number | null, fontWeight: number | null): boolean {
  if (fontSizePx === null) return false;
  if (fontSizePx >= 24) return true;
  return fontSizePx >= 18.66 && (fontWeight ?? 400) >= 700;
}

function classList(element: Element): string[] {
  return Array.from(element.classList);
}

function inheritedValue(element: Element, read: (node: Element) => string | null): string | null {
  let node: Element | null = element;
  while (node && node.nodeType === 1) {
    const value = read(node);
    if (value) return value;
    node = node.parentElement;
  }
  return null;
}

/** Foreground color from inline styles or Tailwind text-color utilities. */
export function textColorForElement(element: Element, variables: Map<string, string>): string | null {
  return inheritedValue(element, (node) => {
    const inlineColor = parseInlineDeclarations(node.getAttribute('style')).get('color');
    if (inlineColor) {
      const resolved = resolveCssVariables(inlineColor, variables).trim();
      if (hasOpaqueColor(resolved)) return resolved;
    }
    for (const className of classList(node)) {
      const color = tailwindColorForClass(className, 'text');
      if (color && hasOpaqueColor(color)) return color;
    }
    return null;
  });
}

/** Walks ancestors until it finds an opaque background (transparent = keep walking). */
export function effectiveBackgroundColor(
  element: Element,
  variables: Map<string, string>,
): string | null {
  let node: Element | null = element;
  while (node && node.nodeType === 1) {
    const declarations = parseInlineDeclarations(node.getAttribute('style'));
    const raw = declarations.get('background-color') ?? declarations.get('background');
    if (raw) {
      const resolved = resolveCssVariables(raw, variables).trim();
      if (hasOpaqueColor(resolved)) return resolved;
    }
    for (const className of classList(node)) {
      const color = tailwindColorForClass(className, 'bg');
      if (color && hasOpaqueColor(color)) return color;
    }
    node = node.parentElement;
  }
  return '#ffffff';
}

export function fontSizeForElement(element: Element): number | null {
  const raw = inheritedValue(element, (node) => {
    const inline = parseInlineDeclarations(node.getAttribute('style')).get('font-size');
    if (inline) return inline;
    for (const className of classList(node)) {
      const size = tailwindFontSizeForClass(className);
      if (size !== null) return `${size}px`;
    }
    return null;
  });
  return parseFontSizePx(raw);
}

export function fontWeightForElement(element: Element): number | null {
  const raw = inheritedValue(element, (node) => {
    const inline = parseInlineDeclarations(node.getAttribute('style')).get('font-weight');
    if (inline) return inline;
    for (const className of classList(node)) {
      const weight = tailwindFontWeightForClass(className);
      if (weight !== null) return String(weight);
    }
    return null;
  });
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  return TAILWIND_FONT_WEIGHTS[raw.toLowerCase()] ?? null;
}

/** Deterministic CSS injected into the iframe so computed styles work offline. */
export function buildSandboxFallbackCss(): string {
  const lines: string[] = [];
  for (const [scale, color] of Object.entries(TAILWIND_COLORS)) {
    lines.push(`.text-${scale}{color:${color}}`);
    lines.push(`.bg-${scale}{background-color:${color}}`);
    lines.push(`.border-${scale}{border-color:${color}}`);
  }
  for (const [scale, size] of Object.entries(TAILWIND_FONT_SIZES)) {
    lines.push(`.text-${scale}{font-size:${size}}`);
  }
  lines.push('.rounded{border-radius:0.25rem}');
  for (const [scale, value] of Object.entries(TAILWIND_SPACING)) {
    for (const prefix of SPACING_PREFIXES) {
      lines.push(`.${prefix}-${scale}{${spacingDeclarations(prefix, value)}}`);
    }
  }
  for (const [scale, value] of Object.entries(TAILWIND_RADIUS)) {
    lines.push(`.rounded-${scale}{border-radius:${value}}`);
  }
  return lines.join('\n');
}

function spacingDeclarations(prefix: string, value: string): string {
  const rule = (property: string) => `${property}:${value}`;
  switch (prefix) {
    case 'p': return rule('padding');
    case 'px': return `${rule('padding-left')};${rule('padding-right')}`;
    case 'py': return `${rule('padding-top')};${rule('padding-bottom')}`;
    case 'pt': return rule('padding-top');
    case 'pr': return rule('padding-right');
    case 'pb': return rule('padding-bottom');
    case 'pl': return rule('padding-left');
    case 'm': return rule('margin');
    case 'mx': return `${rule('margin-left')};${rule('margin-right')}`;
    case 'my': return `${rule('margin-top')};${rule('margin-bottom')}`;
    case 'mt': return rule('margin-top');
    case 'mr': return rule('margin-right');
    case 'mb': return rule('margin-bottom');
    case 'ml': return rule('margin-left');
    case 'gap': return rule('gap');
    case 'gap-x': return rule('column-gap');
    case 'gap-y': return rule('row-gap');
    case 'w': return rule('width');
    case 'h': return rule('height');
    case 'size': return `${rule('width')};${rule('height')}`;
    default: return '';
  }
}

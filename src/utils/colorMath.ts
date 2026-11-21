/**
 * Deterministic color parsing and WCAG 2.x contrast math.
 *
 * Shared by the HTML auditor, the token extractor and the demo AI fixer so
 * every part of the app agrees on what a color value means.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const AA_NORMAL_TEXT_RATIO = 4.5;
export const AA_LARGE_TEXT_RATIO = 3;

const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };

/** Common CSS named colors, normalized to hex for the contrast math. */
const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  maroon: '#800000',
  olive: '#808000',
  green: '#008000',
  purple: '#800080',
  teal: '#008080',
  navy: '#000080',
  orange: '#ffa500',
  gold: '#ffd700',
  pink: '#ffc0cb',
  coral: '#ff7f50',
  crimson: '#dc143c',
  indigo: '#4b0082',
  violet: '#ee82ee',
  tomato: '#ff6347',
  salmon: '#fa8072',
  khaki: '#f0e68c',
  beige: '#f5f5dc',
  ivory: '#fffff0',
  linen: '#faf0e6',
  snow: '#fffafa',
  azure: '#f0ffff',
  mintcream: '#f5fffa',
  honeydew: '#f0fff0',
  aliceblue: '#f0f8ff',
  ghostwhite: '#f8f8ff',
  whitesmoke: '#f5f5f5',
  seashell: '#fff5ee',
  oldlace: '#fdf5e6',
  floralwhite: '#fffaf0',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  navajowhite: '#ffdead',
  moccasin: '#ffe4b5',
  bisque: '#ffe4c4',
  blanchedalmond: '#ffebcd',
  antiquewhite: '#faebd7',
  wheat: '#f5deb3',
  tan: '#d2b48c',
  burlywood: '#deb887',
  saddlebrown: '#8b4513',
  sienna: '#a0522d',
  chocolate: '#d2691e',
  peru: '#cd853f',
  sandybrown: '#f4a460',
  goldenrod: '#daa520',
  darkgoldenrod: '#b8860b',
  orchid: '#da70d6',
  plum: '#dda0dd',
  thistle: '#d8bfd8',
  lavender: '#e6e6fa',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9',
  dimgray: '#696969',
  dimgrey: '#696969',
  slategray: '#708090',
  slategrey: '#708090',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f',
  steelblue: '#4682b4',
  lightblue: '#add8e6',
  skyblue: '#87ceeb',
  deepskyblue: '#00bfff',
  dodgerblue: '#1e90ff',
  cornflowerblue: '#6495ed',
  royalblue: '#4169e1',
  mediumblue: '#0000cd',
  darkblue: '#00008b',
  midnightblue: '#191970',
  navyblue: '#000080',
  lightgreen: '#90ee90',
  palegreen: '#98fb98',
  darkgreen: '#006400',
  forestgreen: '#228b22',
  seagreen: '#2e8b57',
  mediumseagreen: '#3cb371',
  limegreen: '#32cd32',
  yellowgreen: '#9acd32',
  greenyellow: '#adff2f',
  chartreuse: '#7fff00',
  lightcoral: '#f08080',
  darkred: '#8b0000',
  firebrick: '#b22222',
  brown: '#a52a2a',
  darkorange: '#ff8c00',
  orangered: '#ff4500',
  rebeccapurple: '#663399',
  darkviolet: '#9400d3',
  darkorchid: '#9932cc',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  blueviolet: '#8a2be2',
  transparent: '#00000000',
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp255(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function parseAlphaToken(token: string | undefined): number {
  if (token === undefined) return 1;
  const trimmed = token.trim();
  if (!trimmed) return 1;
  if (trimmed.endsWith('%')) return clamp01(parseFloat(trimmed) / 100);
  const alpha = parseFloat(trimmed);
  return Number.isFinite(alpha) ? clamp01(alpha) : 1;
}

function parseChannelToken(token: string): number {
  const trimmed = token.trim();
  if (trimmed.endsWith('%')) return clamp255((parseFloat(trimmed) / 100) * 255);
  return clamp255(parseFloat(trimmed));
}

function hslToRgb(hue: number, saturation: number, lightness: number, alpha: number): Rgb {
  const s = Math.min(100, Math.max(0, saturation)) / 100;
  const l = Math.min(100, Math.max(0, lightness)) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hueSection = ((((hue % 360) + 360) % 360) / 60);
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hueSection < 1) {
    r = chroma;
    g = secondary;
  } else if (hueSection < 2) {
    r = secondary;
    g = chroma;
  } else if (hueSection < 3) {
    g = chroma;
    b = secondary;
  } else if (hueSection < 4) {
    g = secondary;
    b = chroma;
  } else if (hueSection < 5) {
    r = secondary;
    b = chroma;
  } else {
    r = chroma;
    b = secondary;
  }

  const offset = l - chroma / 2;
  return {
    r: clamp255((r + offset) * 255),
    g: clamp255((g + offset) * 255),
    b: clamp255((b + offset) * 255),
    a: alpha,
  };
}

/** Parses hex, rgb(a), hsl(a), modern space-separated rgb and named CSS colors. */
export function parseColor(raw: string | null | undefined): Rgb | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  if (!value || value.startsWith('var(')) return null;

  value = value.replace(/\s*!important\s*$/i, '');

  const named = NAMED_COLORS[value];
  if (named) value = named;

  const hexMatch = /^#([0-9a-f]{3,8})$/.exec(value);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
    return null;
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgbMatch) {
    const tokens = rgbMatch[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
    if (tokens.length < 3) return null;
    const channels = tokens.slice(0, 3).map(parseChannelToken);
    if (channels.some((channel) => !Number.isFinite(channel))) return null;
    return {
      r: channels[0],
      g: channels[1],
      b: channels[2],
      a: parseAlphaToken(tokens[3]),
    };
  }

  const hslMatch = /^hsla?\(([^)]+)\)$/.exec(value);
  if (hslMatch) {
    const tokens = hslMatch[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
    if (tokens.length < 3) return null;
    const hue = parseFloat(tokens[0]);
    const saturation = parseFloat(tokens[1]);
    const lightness = parseFloat(tokens[2]);
    if (![hue, saturation, lightness].every(Number.isFinite)) return null;
    return hslToRgb(hue, saturation, lightness, parseAlphaToken(tokens[3]));
  }

  return null;
}

/** Flattens a foreground color with alpha onto an opaque backdrop. */
function compositeOver(foreground: Rgb, backdrop: Rgb): Rgb {
  if (foreground.a >= 1) return foreground;
  const alpha = clamp01(foreground.a);
  return {
    r: clamp255(foreground.r * alpha + backdrop.r * (1 - alpha)),
    g: clamp255(foreground.g * alpha + backdrop.g * (1 - alpha)),
    b: clamp255(foreground.b * alpha + backdrop.b * (1 - alpha)),
    a: 1,
  };
}

/** WCAG 2.x relative luminance (assumes an opaque, already-composited color). */
export function relativeLuminance(color: Rgb): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** WCAG 2.x contrast ratio. Returns null when either color cannot be parsed. */
export function contrastRatio(
  foreground: string | Rgb,
  background: string | Rgb,
): number | null {
  const fg = typeof foreground === 'string' ? parseColor(foreground) : foreground;
  const bg = typeof background === 'string' ? parseColor(background) : background;
  if (!fg || !bg) return null;

  const backdrop = bg.a < 1 ? compositeOver(bg, WHITE) : bg;
  const solidForeground = compositeOver(fg, backdrop);
  const first = relativeLuminance(solidForeground);
  const second = relativeLuminance(backdrop);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hasOpaqueColor(value: string | null | undefined): boolean {
  const parsed = parseColor(value);
  return parsed !== null && parsed.a > 0;
}

/**
 * Canonical uppercase `#RRGGBB` (or `#RRGGBBAA`) representation of any
 * parseable CSS color. Used by token extraction to display rgb() values as
 * clean hex swatches without losing the original authored value.
 */
export function toHexColor(value: string | null | undefined): string | null {
  const parsed = parseColor(value);
  if (!parsed) return null;
  const hex = [parsed.r, parsed.g, parsed.b]
    .map((channel) => channel.toString(16).padStart(2, '0').toUpperCase())
    .join('');
  return parsed.a < 1
    ? `#${hex}${Math.round(parsed.a * 255).toString(16).padStart(2, '0').toUpperCase()}`
    : `#${hex}`;
}

import type { AuditResult } from '../../types/audit';
import type {
  ContrastPair,
  DesignTokenDocument,
  TokenAuditReport,
  TokenContrastResult,
  TokenValidationIssue,
} from '../../types/tokens';
import { parseColor, relativeLuminance } from '../../utils/colorMath';
import { contrastRatio } from '../../utils/wcagAuditor';

export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') result[key] = entry;
  }
  return result;
}

/** Accepted spellings for each side of a contrast pair in the editor JSON. */
const FOREGROUND_KEYS = ['foreground', 'fg', 'text'] as const;
const BACKGROUND_KEYS = ['background', 'bg', 'surface'] as const;
const LABEL_KEYS = ['label', 'name', 'title'] as const;

function firstString(entry: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function asContrastPairs(value: unknown): ContrastPair[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ContrastPair[] => {
    if (!isRecord(entry)) return [];
    const foreground = firstString(entry, FOREGROUND_KEYS);
    const background = firstString(entry, BACKGROUND_KEYS);
    if (foreground === undefined || background === undefined) return [];

    // Missing labels are derived from the token names; explicit empty labels
    // are preserved so validation can still flag them.
    const authoredLabel = firstString(entry, LABEL_KEYS);
    const pair: ContrastPair = {
      label: authoredLabel ?? `${foreground} on ${background}`,
      foreground,
      background,
    };
    return [pair];
  });
}

const FOREGROUND_NAME = /(?:^|[.\-_/])(?:text|fg|foreground|content|label|copy|body)(?:$|[.\-_/])/i;
const BACKGROUND_NAME = /(?:^|[.\-_/])(?:surface|background|bg|canvas|paper|panel|card|base)(?:$|[.\-_/])/i;
const ON_COLOR_NAME = /(?:^|[.\-_/])on([a-z0-9_-]+)$/i;

function lastSegment(name: string): string {
  const segments = name.split(/[.\-_/]/).filter(Boolean);
  return (segments[segments.length - 1] ?? name).toLowerCase();
}

function luminanceOf(value: string): number | null {
  const parsed = parseColor(value);
  return parsed ? relativeLuminance(parsed) : null;
}

function lightest(names: string[], colors: Record<string, string>): string {
  return names.reduce((best, name) => {
    const bestLuminance = luminanceOf(colors[best]) ?? -1;
    const candidateLuminance = luminanceOf(colors[name]) ?? -1;
    return candidateLuminance > bestLuminance ? name : best;
  }, names[0]);
}

function darkest(names: string[], colors: Record<string, string>): string {
  return names.reduce((best, name) => {
    const bestLuminance = luminanceOf(colors[best]) ?? 2;
    const candidateLuminance = luminanceOf(colors[name]) ?? 2;
    return candidateLuminance < bestLuminance ? name : best;
  }, names[0]);
}

/**
 * Deterministic fallback when the JSON omits `contrastPairs`: pair semantic
 * text tokens with the lightest surface, honour `onPrimary`-style pairs, and
 * otherwise compare the darkest token against the lightest one.
 */
export function inferContrastPairs(colors: Record<string, string>): ContrastPair[] {
  const names = Object.keys(colors);
  if (names.length < 2) return [];

  const pairs: ContrastPair[] = [];
  const seen = new Set<string>();
  const addPair = (foreground: string, background: string) => {
    if (foreground === background || !colors[foreground] || !colors[background]) return;
    const key = `${foreground}\u0000${background}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ label: `${foreground} on ${background}`, foreground, background });
  };

  for (const name of names) {
    const match = ON_COLOR_NAME.exec(name);
    if (!match) continue;
    const target = match[1].toLowerCase();
    const prefix = name.slice(0, match.index);
    const sameScope = names.filter(
      (candidate) => candidate !== name && prefix.length > 0 && candidate.startsWith(`${prefix}.`),
    );
    const pool = (sameScope.length > 0 ? sameScope : names).filter(
      (candidate) => candidate !== name && lastSegment(candidate) === target,
    );
    const candidates = pool.filter((candidate) => !FOREGROUND_NAME.test(candidate));
    if (candidates.length > 0) addPair(name, lightest(candidates, colors));
  }

  const textNames = names.filter((name) => FOREGROUND_NAME.test(name));
  const surfaceNames = names.filter((name) => BACKGROUND_NAME.test(name));
  if (textNames.length > 0 && surfaceNames.length > 0) {
    const surface = lightest(surfaceNames, colors);
    for (const textName of textNames) addPair(textName, surface);
  }

  if (pairs.length === 0) {
    addPair(darkest(names, colors), lightest(names, colors));
  }

  return pairs;
}

/** Parses the editor JSON without throwing; malformed input is reported as an error string. */
export function parseTokenDocument(
  json: string,
): { document: DesignTokenDocument | null; error: string | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return {
      document: null,
      error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isRecord(raw)) {
    return { document: null, error: 'Token document must be a JSON object.' };
  }

  const typography = isRecord(raw.typography) ? raw.typography : {};
  // Both `color` and `colors` are accepted; the singular key wins on conflicts.
  const colors = { ...asStringRecord(raw.colors), ...asStringRecord(raw.color) };
  const pairsOmitted =
    !Object.prototype.hasOwnProperty.call(raw, 'contrastPairs') || raw.contrastPairs === null;

  return {
    document: {
      color: colors,
      spacing: asStringRecord(raw.spacing),
      typography: {
        fontFamily: asStringRecord(typography.fontFamily),
        fontSize: asStringRecord(typography.fontSize),
      },
      contrastPairs: pairsOmitted
        ? inferContrastPairs(colors)
        : asContrastPairs(raw.contrastPairs),
    },
    error: null,
  };
}

/** Deterministic token validation: hex values, empty values and pair references. */
export function validateTokenDocument(document: DesignTokenDocument): TokenValidationIssue[] {
  const issues: TokenValidationIssue[] = [];

  for (const [name, value] of Object.entries(document.color)) {
    if (!isHexColor(value)) {
      issues.push({
        path: `color.${name}`,
        message: `Expected a hex color such as #RRGGBB or #RGBA; received "${value || 'empty'}".`,
        severity: 'error',
      });
    }
  }

  for (const [name, value] of Object.entries(document.spacing)) {
    if (!value.trim()) {
      issues.push({
        path: `spacing.${name}`,
        message: 'Spacing token cannot be empty.',
        severity: 'error',
      });
    }
  }

  for (const groupName of ['fontFamily', 'fontSize'] as const) {
    for (const [name, value] of Object.entries(document.typography[groupName])) {
      if (!value.trim()) {
        issues.push({
          path: `typography.${groupName}.${name}`,
          message: 'Typography token cannot be empty.',
          severity: 'error',
        });
      }
    }
  }

  for (const [index, pair] of document.contrastPairs.entries()) {
    const path = `contrastPairs[${index}]`;
    if (!pair.label.trim()) {
      issues.push({ path, message: 'Pair label cannot be empty.', severity: 'warning' });
    }
    if (!document.color[pair.foreground]) {
      issues.push({
        path: `${path}.foreground`,
        message: `Unknown color token "${pair.foreground || 'empty'}".`,
        severity: 'error',
      });
    }
    if (!document.color[pair.background]) {
      issues.push({
        path: `${path}.background`,
        message: `Unknown color token "${pair.background || 'empty'}".`,
        severity: 'error',
      });
    }
  }

  if (Object.keys(document.color).length < 2) {
    issues.push({
      path: 'color',
      message: 'Add at least two color tokens to compare foreground and background pairs.',
      severity: 'warning',
    });
  }
  if (document.contrastPairs.length === 0) {
    issues.push({
      path: 'contrastPairs',
      message: 'No contrast pairs configured; add one to audit WCAG AA compliance.',
      severity: 'warning',
    });
  }

  return issues;
}

/** Uses the shared deterministic WCAG engine for every configured token pair. */
export function buildContrastResults(document: DesignTokenDocument): TokenContrastResult[] {
  return document.contrastPairs.map((pair, index) => {
    const foregroundValue = document.color[pair.foreground] ?? '';
    const backgroundValue = document.color[pair.background] ?? '';
    const canCompare = isHexColor(foregroundValue) && isHexColor(backgroundValue);
    const ratio = canCompare ? contrastRatio(foregroundValue, backgroundValue) : null;

    return {
      id: `${index}-${pair.foreground}-${pair.background}`,
      label: pair.label || `Pair ${index + 1}`,
      foregroundToken: pair.foreground,
      backgroundToken: pair.background,
      foregroundValue,
      backgroundValue,
      ratio: ratio === null ? null : Math.round(ratio * 100) / 100,
      passesAaNormal: ratio !== null && ratio >= AA_NORMAL_TEXT,
      passesAaLarge: ratio !== null && ratio >= AA_LARGE_TEXT,
    };
  });
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
}

function appendVariables(lines: string[], prefix: string, entries: Record<string, string>): void {
  for (const [name, value] of Object.entries(entries)) {
    if (!value.trim()) continue;
    lines.push(`  --${toKebabCase(`${prefix}-${name}`)}: ${value.trim()};`);
  }
}

/** Flattens the token document into a CSS custom-property block. */
export function buildCssVariables(document: DesignTokenDocument): string {
  const lines = [':root {'];
  appendVariables(lines, 'color', document.color);
  appendVariables(lines, 'spacing', document.spacing);
  appendVariables(lines, 'font-family', document.typography.fontFamily);
  appendVariables(lines, 'font-size', document.typography.fontSize);
  lines.push('}');
  return lines.join('\n');
}

export function countTokens(document: DesignTokenDocument): number {
  return (
    Object.keys(document.color).length +
    Object.keys(document.spacing).length +
    Object.keys(document.typography.fontFamily).length +
    Object.keys(document.typography.fontSize).length
  );
}

export function buildTokenAuditReport(
  document: DesignTokenDocument,
  validation: TokenValidationIssue[],
  contrastChecks: TokenContrastResult[],
  htmlAudit: AuditResult | null,
): TokenAuditReport {
  return {
    generatedAt: new Date().toISOString(),
    tokenCount: countTokens(document),
    validation,
    contrastChecks,
    contrastSummary: {
      passed: contrastChecks.filter((check) => check.passesAaNormal).length,
      failed: contrastChecks.filter((check) => check.ratio !== null && !check.passesAaNormal)
        .length,
      skipped: contrastChecks.filter((check) => check.ratio === null).length,
    },
    requiredRatios: { normalText: AA_NORMAL_TEXT, largeText: AA_LARGE_TEXT },
    tokens: document,
    htmlAudit,
  };
}

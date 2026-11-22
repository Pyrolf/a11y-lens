import { describe, expect, it } from 'vitest';
import type { DesignTokenDocument } from '../../src/types/tokens.ts';
import {
  buildContrastResults,
  buildCssVariables,
  buildTokenAuditReport,
  countTokens,
  inferContrastPairs,
  isHexColor,
  parseTokenDocument,
  validateTokenDocument,
} from '../../src/engine/tokens/tokenAudit.ts';

const document: DesignTokenDocument = {
  color: {
    'color.text.primary': '#111111',
    'color.surface': '#ffffff',
    'color.primary': '#2563eb',
    'color.onPrimary': '#ffffff',
  },
  spacing: { 'space-1': '4px', 'space-2': '8px' },
  typography: {
    fontFamily: { sans: 'Inter, sans-serif' },
    fontSize: { body: '16px' },
  },
  contrastPairs: [
    { label: 'Body text', foreground: 'color.text.primary', background: 'color.surface' },
  ],
};

describe('isHexColor', () => {
  it('accepts 3/4/6/8 digit hex values and rejects other formats', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('#ffff')).toBe(true);
    expect(isHexColor('#ffffff')).toBe(true);
    expect(isHexColor('#ffffffff')).toBe(true);
    expect(isHexColor('rgb(0, 0, 0)')).toBe(false);
    expect(isHexColor('#fffff')).toBe(false);
  });
});

describe('parseTokenDocument', () => {
  it('parses a valid document and preserves explicit contrast pairs', () => {
    const parsed = parseTokenDocument(JSON.stringify(document));
    expect(parsed.error).toBeNull();
    expect(parsed.document?.color).toEqual(document.color);
    expect(parsed.document?.contrastPairs).toEqual(document.contrastPairs);
  });

  it('merges colors and color aliases with the singular key winning', () => {
    const parsed = parseTokenDocument(
      JSON.stringify({
        colors: { surface: '#ffffff', brand: '#000000' },
        color: { brand: '#111111' },
      }),
    );
    expect(parsed.document?.color).toEqual({ surface: '#ffffff', brand: '#111111' });
  });

  it('infers contrast pairs when the field is omitted or null', () => {
    const omitted = parseTokenDocument(
      JSON.stringify({ colors: { text: '#111111', surface: '#ffffff' } }),
    );
    expect(omitted.document?.contrastPairs).toEqual([
      {
        label: 'text on surface',
        foreground: 'text',
        background: 'surface',
      },
    ]);

    const explicitNull = parseTokenDocument(
      JSON.stringify({ colors: { text: '#111111', surface: '#ffffff' }, contrastPairs: null }),
    );
    expect(explicitNull.document?.contrastPairs).toHaveLength(1);
  });

  it('keeps an explicitly empty contrastPairs array', () => {
    const parsed = parseTokenDocument(
      JSON.stringify({ colors: { text: '#111111', surface: '#ffffff' }, contrastPairs: [] }),
    );
    expect(parsed.document?.contrastPairs).toEqual([]);
  });

  it('drops malformed pair entries and derives missing labels', () => {
    const parsed = parseTokenDocument(
      JSON.stringify({
        colors: { text: '#111111', surface: '#ffffff' },
        contrastPairs: [
          { fg: 'text', bg: 'surface' },
          { foreground: 'text' },
          'not-an-object',
        ],
      }),
    );
    expect(parsed.document?.contrastPairs).toEqual([
      { label: 'text on surface', foreground: 'text', background: 'surface' },
    ]);
  });

  it('reports invalid JSON and non-object documents without throwing', () => {
    expect(parseTokenDocument('{').error).toMatch(/Invalid JSON/);
    expect(parseTokenDocument('[]').error).toBe('Token document must be a JSON object.');
  });
});

describe('inferContrastPairs', () => {
  it('pairs semantic text tokens with the lightest surface', () => {
    const pairs = inferContrastPairs({
      'color.text.primary': '#111111',
      'color.surface': '#ffffff',
      'color.surface.subtle': '#f8fafc',
    });
    expect(pairs).toContainEqual({
      label: 'color.text.primary on color.surface',
      foreground: 'color.text.primary',
      background: 'color.surface',
    });
  });

  it('honours onPrimary-style semantic pairs', () => {
    const pairs = inferContrastPairs({
      'color.primary': '#2563eb',
      'color.onPrimary': '#ffffff',
    });
    expect(pairs).toContainEqual({
      label: 'color.onPrimary on color.primary',
      foreground: 'color.onPrimary',
      background: 'color.primary',
    });
  });

  it('falls back to the darkest and lightest colors', () => {
    const pairs = inferContrastPairs({ ink: '#111111', paper: '#ffffff' });
    expect(pairs).toEqual([
      { label: 'ink on paper', foreground: 'ink', background: 'paper' },
    ]);
  });

  it('returns no pairs when there are fewer than two colors', () => {
    expect(inferContrastPairs({ only: '#ffffff' })).toEqual([]);
  });
});

describe('validateTokenDocument', () => {
  it('accepts a valid document', () => {
    expect(validateTokenDocument(document)).toEqual([]);
  });

  it('reports invalid colors, empty values, and unknown pair references', () => {
    const issues = validateTokenDocument({
      ...document,
      color: { ...document.color, bad: 'rgb(0, 0, 0)', empty: '' },
      spacing: { ...document.spacing, empty: '  ' },
      typography: {
        fontFamily: { empty: '' },
        fontSize: { empty: '' },
      },
      contrastPairs: [
        { label: '', foreground: 'missing', background: 'color.surface' },
      ],
    });
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'color.bad',
        'color.empty',
        'spacing.empty',
        'typography.fontFamily.empty',
        'typography.fontSize.empty',
        'contrastPairs[0]',
        'contrastPairs[0].foreground',
      ]),
    );
    expect(issues.find((issue) => issue.path === 'contrastPairs[0]')?.severity).toBe(
      'warning',
    );
  });

  it('warns when the document has too few colors or no contrast pairs', () => {
    const issues = validateTokenDocument({
      color: { only: '#ffffff' },
      spacing: {},
      typography: { fontFamily: {}, fontSize: {} },
      contrastPairs: [],
    });
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['color', 'contrastPairs']),
    );
  });
});

describe('buildContrastResults', () => {
  it('passes and fails pairs using the shared WCAG engine', () => {
    const results = buildContrastResults({
      ...document,
      color: {
        ...document.color,
        'color.text.muted': '#777777',
      },
      contrastPairs: [
        { label: 'Strong', foreground: 'color.text.primary', background: 'color.surface' },
        { label: 'Muted', foreground: 'color.text.muted', background: 'color.surface' },
      ],
    });

    expect(results[0]).toMatchObject({
      ratio: 18.88,
      passesAaNormal: true,
      passesAaLarge: true,
    });
    expect(results[1]).toMatchObject({
      ratio: 4.48,
      passesAaNormal: false,
      passesAaLarge: true,
    });
  });

  it('skips pairs whose token values are not valid hex colors', () => {
    const [result] = buildContrastResults({
      ...document,
      color: { ...document.color, broken: 'not-a-color' },
      contrastPairs: [{ label: 'Broken', foreground: 'broken', background: 'color.surface' }],
    });
    expect(result.ratio).toBeNull();
    expect(result.passesAaNormal).toBe(false);
    expect(result.passesAaLarge).toBe(false);
  });
});

describe('buildCssVariables and countTokens', () => {
  it('flattens token groups into kebab-case custom properties', () => {
    expect(buildCssVariables(document)).toBe(
      [
        ':root {',
        '  --color-color-text-primary: #111111;',
        '  --color-color-surface: #ffffff;',
        '  --color-color-primary: #2563eb;',
        '  --color-color-on-primary: #ffffff;',
        '  --spacing-space-1: 4px;',
        '  --spacing-space-2: 8px;',
        '  --font-family-sans: Inter, sans-serif;',
        '  --font-size-body: 16px;',
        '}',
      ].join('\n'),
    );
  });

  it('counts every token group', () => {
    expect(countTokens(document)).toBe(8);
  });
});

describe('buildTokenAuditReport', () => {
  it('summarizes passed, failed, and skipped contrast checks', () => {
    const contrastChecks = buildContrastResults({
      ...document,
      color: { ...document.color, 'color.text.muted': '#777777', broken: 'nope' },
      contrastPairs: [
        { label: 'Pass', foreground: 'color.text.primary', background: 'color.surface' },
        { label: 'Fail', foreground: 'color.text.muted', background: 'color.surface' },
        { label: 'Skip', foreground: 'broken', background: 'color.surface' },
      ],
    });
    const report = buildTokenAuditReport(document, [], contrastChecks, null);
    expect(report.contrastSummary).toEqual({ passed: 1, failed: 1, skipped: 1 });
    expect(report.tokenCount).toBe(8);
    expect(report.requiredRatios).toEqual({ normalText: 4.5, largeText: 3 });
    expect(report.htmlAudit).toBeNull();
  });
});

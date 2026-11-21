import type { AuditResult } from './audit';

export type TokenKind =
  | 'color'
  | 'font-family'
  | 'font-size'
  | 'spacing'
  | 'radius'
  | 'shadow'
  | 'other';

export type TokenSource = 'css-variable' | 'tailwind-class' | 'inline-style' | 'computed-style';

/**
 * Where a token's value came from:
 * - `authored`: explicitly declared in the snippet (Tailwind, var(--*), inline style).
 * - `inherited`: an inherited/browser-default computed style on an element that
 *   did not explicitly declare that property.
 */
export type TokenOrigin = 'authored' | 'inherited';

export interface DesignToken {
  id: string;
  kind: TokenKind;
  name: string;
  /** Display value: uppercase #HEX for colors, raw value for other token kinds. */
  value: string;
  /** Original authored/computed value (e.g. `rgb(15, 23, 42)`) when different. */
  originalValue?: string;
  source: TokenSource;
  /** Authored declaration vs inherited/browser-default computed value. */
  origin: TokenOrigin;
  /** Convenience mirror of `origin === 'inherited'` for existing consumers. */
  inherited: boolean;
  occurrences: number;
  usageExamples: string[];
}

export interface TokenExtractionResult {
  snippetId: string;
  extractedAt: string;
  tokens: DesignToken[];
  warnings: string[];
}

/**
 * A foreground/background token pair that should be checked against WCAG AA.
 * Editor JSON may spell the sides `foreground`/`background`, `fg`/`bg` or
 * `text`/`surface`; all forms normalize to this shape.
 */
export interface ContrastPair {
  label: string;
  foreground: string;
  background: string;
}

/** Shape of the JSON document edited in the Design Tokens tab. */
export interface DesignTokenDocument {
  color: Record<string, string>;
  spacing: Record<string, string>;
  typography: {
    fontFamily: Record<string, string>;
    fontSize: Record<string, string>;
  };
  contrastPairs: ContrastPair[];
}

export interface TokenValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface TokenContrastResult {
  id: string;
  label: string;
  foregroundToken: string;
  backgroundToken: string;
  foregroundValue: string;
  backgroundValue: string;
  /** Rounded to two decimals for display; null when a token cannot be checked. */
  ratio: number | null;
  passesAaNormal: boolean;
  passesAaLarge: boolean;
}

export interface TokenAuditReport {
  generatedAt: string;
  tokenCount: number;
  validation: TokenValidationIssue[];
  contrastChecks: TokenContrastResult[];
  contrastSummary: { passed: number; failed: number; skipped: number };
  requiredRatios: { normalText: number; largeText: number };
  tokens: DesignTokenDocument;
  htmlAudit: AuditResult | null;
}

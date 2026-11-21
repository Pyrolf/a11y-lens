import type { DesignTokenDocument } from '../types/tokens';

/**
 * Pre-populated tokens for the Design Tokens tab. One pair intentionally fails
 * AA so the pass/fail badge behaviour is visible without any editing.
 */
const SAMPLE_TOKENS: DesignTokenDocument = {
  color: {
    'surface.base': '#FFFFFF',
    'surface.raised': '#F8FAFC',
    'text.primary': '#111827',
    'text.muted': '#64748B',
    'text.placeholder': '#CBD5E1',
    'brand.primary': '#4F46E5',
    'brand.onPrimary': '#FFFFFF',
    'feedback.error': '#DC2626',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  typography: {
    fontFamily: {
      sans: 'system-ui, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, monospace',
    },
    fontSize: {
      sm: '14px',
      base: '16px',
      lg: '24px',
    },
  },
  contrastPairs: [
    {
      label: 'Body text on surface',
      foreground: 'text.primary',
      background: 'surface.base',
    },
    {
      label: 'Muted caption on surface',
      foreground: 'text.muted',
      background: 'surface.base',
    },
    {
      label: 'Primary button label',
      foreground: 'brand.onPrimary',
      background: 'brand.primary',
    },
    {
      label: 'Placeholder text on surface',
      foreground: 'text.placeholder',
      background: 'surface.base',
    },
  ],
};

export const SAMPLE_TOKEN_JSON = JSON.stringify(SAMPLE_TOKENS, null, 2);

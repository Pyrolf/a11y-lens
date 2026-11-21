import { useMemo } from 'react';
import type { DesignToken, TokenExtractionResult } from '../../types/tokens';
import { TokenGroup } from './TokenGroup';

interface DesignTokensTabProps {
  result: TokenExtractionResult | null;
}

/**
 * Single authored-only view: tokens explicitly declared in the editor as
 * Tailwind utilities, CSS variables or inline styles. The WCAG audit runs
 * separately against the full computed-style snapshot, so implicit contrast
 * bugs are still reported in the Audit Report.
 */
export function DesignTokensTab({ result }: DesignTokensTabProps) {
  const visibleTokens = useMemo<DesignToken[]>(
    () => result?.tokens.filter((token) => token.origin === 'authored') ?? [],
    [result],
  );

  const colors = visibleTokens.filter((token) => token.kind === 'color');
  const typography = visibleTokens.filter(
    (token) => token.kind === 'font-family' || token.kind === 'font-size',
  );
  const spacing = visibleTokens.filter(
    (token) => token.kind === 'spacing' || token.kind === 'radius' || token.kind === 'shadow',
  );
  const other = visibleTokens.filter(
    (token) =>
      token.kind !== 'color' &&
      token.kind !== 'font-family' &&
      token.kind !== 'font-size' &&
      token.kind !== 'spacing' &&
      token.kind !== 'radius' &&
      token.kind !== 'shadow',
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Authored Tokens</h3>
        {result && (
          <span data-testid="authored-token-summary" className="text-xs text-slate-400">
            {visibleTokens.length} tokens declared in the editor
          </span>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Only values explicitly defined with Tailwind classes, CSS variables or inline styles.
        Contrast checks still use every computed style.
      </p>

      {!result ? (
        <p className="text-sm text-slate-400">Design tokens will appear after preview analysis.</p>
      ) : (
        <div className="space-y-3" data-testid="extracted-token-list">
          {result.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {result.warnings.join(' ')}
            </div>
          )}
          <TokenGroup title="Colors" tokens={colors} />
          <TokenGroup title="Typography" tokens={typography} />
          <TokenGroup title="Spacing / Shape" tokens={spacing} />
          <TokenGroup title="Other" tokens={other} />
        </div>
      )}
    </div>
  );
}

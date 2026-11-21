import { useMemo } from 'react';
import {
  AA_LARGE_TEXT,
  AA_NORMAL_TEXT,
  buildContrastResults,
  isHexColor,
  parseTokenDocument,
  validateTokenDocument,
} from '../../engine/tokens/tokenAudit';

interface TokenInsightsProps {
  json: string;
}

/**
 * Right-hand, read-only view of the JSON being edited on the left. Every
 * section recomputes from the JSON string so the swatches, contrast matrix and
 * validation summary stay in sync with each keystroke.
 */
export function TokenInsights({ json }: TokenInsightsProps) {
  const parsed = useMemo(() => parseTokenDocument(json), [json]);
  const tokenDocument = parsed.document;
  const validation = useMemo(
    () => (tokenDocument ? validateTokenDocument(tokenDocument) : []),
    [tokenDocument],
  );
  const contrastChecks = useMemo(
    () => (tokenDocument ? buildContrastResults(tokenDocument) : []),
    [tokenDocument],
  );
  const colorEntries = useMemo(
    () => (tokenDocument ? Object.entries(tokenDocument.color) : []),
    [tokenDocument],
  );

  const errorCount = validation.filter((issue) => issue.severity === 'error').length;
  const warningCount = validation.length - errorCount;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="token-insights-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Design Token Insights
          </p>
          <h2 className="text-sm font-semibold text-slate-100">Live from the token JSON editor</h2>
        </div>
        <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200">
          {colorEntries.length} colors · {contrastChecks.length} pairs
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Token Validation Summary</h3>
          {parsed.error ? (
            <div
              role="alert"
              data-testid="token-validation"
              className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              {parsed.error}
            </div>
          ) : validation.length > 0 ? (
            <div
              data-testid="token-validation"
              className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"
            >
              <p className="font-semibold">
                {errorCount} error{errorCount === 1 ? '' : 's'} and {warningCount} warning
                {warningCount === 1 ? '' : 's'}
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {validation.map((issue, index) => (
                  <li key={`${issue.path}-${index}`}>
                    <span className="font-mono">{issue.path}</span>: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div
              data-testid="token-validation"
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"
            >
              JSON valid · all {colorEntries.length} hex colors verified · no issues
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Design Token Swatch Grid</h3>
          {colorEntries.length === 0 ? (
            <p className="text-xs text-slate-400">No color tokens found in the JSON.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {colorEntries.map(([name, hex]) => {
                const valid = isHexColor(hex);
                const usedInPairs = contrastChecks.filter(
                  (check) => check.foregroundToken === name,
                );
                const aaPasses = usedInPairs.every((check) => check.passesAaNormal);
                return (
                  <div
                    key={name}
                    data-testid="color-token"
                    className="rounded-md border border-slate-800 bg-slate-950/50 p-2"
                  >
                    <div
                      className="h-10 rounded border border-white/10"
                      style={{ backgroundColor: valid ? hex : 'transparent' }}
                    />
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="truncate font-mono text-xs text-slate-200" title={name}>
                        {name}
                      </span>
                      <span
                        data-testid={valid ? undefined : 'invalid-hex-badge'}
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
                          !valid || (usedInPairs.length > 0 && !aaPasses)
                            ? 'bg-rose-500/15 text-rose-300'
                            : 'bg-emerald-500/10 text-emerald-300'
                        }`}
                      >
                        {!valid
                          ? 'Invalid'
                          : usedInPairs.length > 0
                            ? aaPasses
                              ? 'AA PASS'
                              : 'AA FAIL'
                            : 'Valid'}
                      </span>
                    </div>
                    <code className="block truncate text-xs text-slate-400">
                      {hex || '(empty)'}
                    </code>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">WCAG Contrast Pair Matrix</h3>
            <span className="text-xs text-slate-400">
              Normal ≥ {AA_NORMAL_TEXT}:1 · Large ≥ {AA_LARGE_TEXT}:1
            </span>
          </div>
          {contrastChecks.length === 0 ? (
            <p className="text-xs text-slate-400">No contrast pairs configured in the JSON.</p>
          ) : (
            <ul data-testid="contrast-check-list" className="space-y-2">
              {contrastChecks.map((check) => {
                const foreground = isHexColor(check.foregroundValue)
                  ? check.foregroundValue
                  : undefined;
                const background = isHexColor(check.backgroundValue)
                  ? check.backgroundValue
                  : undefined;
                return (
                  <li
                    key={check.id}
                    data-testid="contrast-check"
                    className="rounded-md border border-slate-800 bg-slate-950/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-100">
                          {check.label}
                        </p>
                        <p className="truncate font-mono text-xs text-slate-400">
                          {check.foregroundToken} on {check.backgroundToken}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          data-testid="contrast-badge"
                          className={`inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                            check.ratio === null
                              ? 'bg-slate-700 text-slate-300'
                              : check.passesAaNormal
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {check.ratio === null ? 'N/A' : check.passesAaNormal ? 'PASS' : 'FAIL'}
                        </span>
                        <p className="mt-1 font-mono text-xs text-slate-300">
                          {check.ratio === null ? '—' : `${check.ratio.toFixed(2)}:1`}
                        </p>
                      </div>
                    </div>
                    <div
                      className="mt-2 rounded p-2 text-sm"
                      style={{ color: foreground, backgroundColor: background }}
                    >
                      Aa The quick brown fox jumps over the lazy dog
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {tokenDocument && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-100">Spacing &amp; Typography</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(tokenDocument.spacing).map(([name, size]) => (
                <span
                  key={`spacing-${name}`}
                  className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1 font-mono text-xs text-slate-300"
                >
                  spacing.{name}: {size}
                </span>
              ))}
              {(['fontFamily', 'fontSize'] as const).flatMap((group) =>
                Object.entries(tokenDocument.typography[group]).map(([name, value]) => (
                  <span
                    key={`${group}-${name}`}
                    className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1 font-mono text-xs text-slate-300"
                  >
                    {group}.{name}: {value}
                  </span>
                )),
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

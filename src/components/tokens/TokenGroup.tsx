import type { DesignToken } from '../../types/tokens';

interface TokenGroupProps {
  title: string;
  tokens: DesignToken[];
}

export function TokenGroup({ title, tokens }: TokenGroupProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {tokens.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No tokens detected.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tokens.map((token) => (
            <li
              key={token.id}
              data-testid="extracted-token"
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-slate-800/70 bg-slate-950/40 px-2 py-1.5 text-xs"
            >
              <span className="font-mono text-slate-200">{token.name}</span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <code data-testid="token-value" className="font-mono font-medium text-slate-100">
                  {token.value}
                </code>
                {token.originalValue && token.originalValue !== token.value && (
                  <span className="font-mono text-slate-400">{token.originalValue}</span>
                )}
                <span
                  data-testid="token-usage-badge"
                  className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-200"
                >
                  {token.occurrences} {token.occurrences === 1 ? 'element' : 'elements'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

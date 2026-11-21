import type { AuditIssue } from '../../types/audit';

interface AuditIssueListProps {
  issues: AuditIssue[];
  selectedIssueIds: string[];
  onToggleIssue: (issueId: string) => void;
}

const severityClass: Record<AuditIssue['severity'], string> = {
  error: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  warning: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  info: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
};

export function AuditIssueList({ issues, selectedIssueIds, onToggleIssue }: AuditIssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        No issues found. Deterministic checks and axe-core rules passed for this snippet.
      </div>
    );
  }

  return (
    <ul className="space-y-3" data-testid="audit-issue-list">
      {issues.map((issue) => {
        const selected = selectedIssueIds.includes(issue.id);
        return (
          <li key={issue.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleIssue(issue.id)}
                aria-label={`Select issue ${issue.message}`}
                className="mt-1 h-4 w-4 accent-indigo-500"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-xs uppercase ${severityClass[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className="text-xs text-slate-400">{issue.ruleId}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-100">{issue.message}</p>
                <p className="mt-1 text-xs text-slate-400">{issue.help}</p>

                {issue.details?.contrastRatio !== undefined && (
                  <p className="mt-1 text-xs text-slate-400">
                    Ratio{' '}
                    <span className="font-mono text-rose-200">{issue.details.contrastRatio.toFixed(2)}:1</span>
                    {' · required '}
                    <span className="font-mono">{issue.details.requiredRatio}:1</span>
                    {' · '}
                    <span className="font-mono">{issue.details.foreground}</span>
                    {' on '}
                    <span className="font-mono">{issue.details.background}</span>
                  </p>
                )}
                {issue.details?.expected && (
                  <p className="mt-1 text-xs text-slate-400">
                    Expected: <span className="font-mono text-emerald-200">{issue.details.expected}</span>
                    {issue.details.actual && (
                      <>
                        {' · actual: '}
                        <span className="font-mono text-rose-200">{issue.details.actual}</span>
                      </>
                    )}
                  </p>
                )}
                <p
                  className="mt-1 truncate font-mono text-xs text-slate-400"
                  title={issue.node.snippet}
                >
                  {issue.node.selector}
                  {issue.node.lineHint !== undefined ? ` · line ${issue.node.lineHint}` : ''}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

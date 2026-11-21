import { useState } from 'react';
import type { AuditResult } from '../../types/audit';
import { AuditIssueList } from './AuditIssueList';

interface AuditReportProps {
  result: AuditResult | null;
  selectedIssueIds: string[];
  onToggleIssue: (issueId: string) => void;
}

const VISIBLE_PASSED_RULES = 4;
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export function AuditReport({ result, selectedIssueIds, onToggleIssue }: AuditReportProps) {
  const [showAllPassed, setShowAllPassed] = useState(false);
  const passedRules = result?.summary.passedRules ?? [];
  const overflowCount = Math.max(0, passedRules.length - VISIBLE_PASSED_RULES);
  const visiblePassedRules = showAllPassed
    ? passedRules
    : passedRules.slice(0, VISIBLE_PASSED_RULES);

  const announcement = result
    ? `Audit complete. ${plural(result.issues.length, 'issue')} found: ` +
      `${plural(result.summary.errors, 'error')}, ${plural(result.summary.warnings, 'warning')}, ` +
      `${plural(result.summary.infos, 'info')}. Checked ${passedRules.length}/` +
      `${result.summary.totalRules} WCAG rules.`
    : 'No audit results yet.';

  if (!result) {
    return (
      <>
        <p role="status" aria-live="polite" className="sr-only" data-testid="audit-status">
          {announcement}
        </p>
        <p className="text-sm text-slate-400">Run an audit to see deterministic WCAG findings.</p>
      </>
    );
  }

  return (
    <div className="space-y-4" data-testid="audit-report">
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="audit-status"
      >
        {announcement}
      </p>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-rose-200">
          <div className="text-lg font-semibold">{result.summary.errors}</div>Errors
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
          <div className="text-lg font-semibold">{result.summary.warnings}</div>Warnings
        </div>
        <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-2 text-sky-200">
          <div className="text-lg font-semibold">{result.summary.infos}</div>Info
        </div>
      </div>

      <AuditIssueList
        issues={result.issues}
        selectedIssueIds={selectedIssueIds}
        onToggleIssue={onToggleIssue}
      />

      <div
        className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5 text-xs text-slate-400"
        data-testid="audit-rules-summary"
      >
        <span data-testid="audit-rule-count">
          Checked {passedRules.length}/{result.summary.totalRules} WCAG rules
        </span>
        {passedRules.length > 0 && (
          <>
            <span> · passed: </span>
            <span
              id="audit-passed-rules"
              className="mt-2 flex flex-wrap items-center gap-1.5"
            >
              {visiblePassedRules.map((rule) => (
                <span
                  key={rule.id}
                  title={rule.description}
                  data-testid="audit-passed-rule"
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-200"
                >
                  {rule.id}
                </span>
              ))}
              {overflowCount > 0 && (
                <button
                  type="button"
                  data-testid="audit-passed-overflow"
                  aria-expanded={showAllPassed}
                  aria-controls="audit-passed-rules"
                  onClick={() => setShowAllPassed((previous) => !previous)}
                  className="rounded-full border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  {showAllPassed ? 'Show less' : `+${overflowCount} more`}
                </button>
              )}
            </span>
          </>
        )}
        <span> · {result.durationMs}ms</span>
      </div>
    </div>
  );
}

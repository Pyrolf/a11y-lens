import { useState } from 'react';
import type { AuditResult } from '../../types/audit';
import { AuditIssueList } from './AuditIssueList';

function downloadAuditReport(result: AuditResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `a11y-lens-audit-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function buildHtmlReport(result: AuditResult): string {
  const issueRows = result.issues
    .map(
      (issue) =>
        `<tr><td>${escapeHtml(issue.severity)}</td><td>${escapeHtml(issue.ruleId)}</td>` +
        `<td>${escapeHtml(issue.node.selector)}</td><td>${escapeHtml(issue.message)}</td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>A11y-Lens Audit Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #0f172a; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #cbd5e1; padding: 0.5rem; text-align: left; vertical-align: top; }
    th { background: #e2e8f0; }
    .summary { display: flex; gap: 1rem; margin: 1rem 0; }
    .card { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.75rem 1rem; }
  </style>
</head>
<body>
  <h1>A11y-Lens Audit Report</h1>
  <p>Generated ${escapeHtml(result.ranAt)} · ${result.durationMs}ms</p>
  <div class="summary">
    <div class="card"><strong>${result.summary.errors}</strong><br />Errors</div>
    <div class="card"><strong>${result.summary.warnings}</strong><br />Warnings</div>
    <div class="card"><strong>${result.summary.infos}</strong><br />Info</div>
    <div class="card"><strong>${result.summary.passedRules.length}/${result.summary.totalRules}</strong><br />WCAG rules</div>
  </div>
  <table>
    <thead><tr><th>Severity</th><th>Rule</th><th>Selector</th><th>Message</th></tr></thead>
    <tbody>${issueRows || '<tr><td colspan="4">No issues found.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadHtmlReport(result: AuditResult) {
  const blob = new Blob([buildHtmlReport(result)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `a11y-lens-audit-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

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

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="download-audit-json"
          onClick={() => downloadAuditReport(result)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          Download Audit JSON
        </button>
        <button
          type="button"
          data-testid="download-audit-html"
          onClick={() => downloadHtmlReport(result)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          Download HTML Report
        </button>
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

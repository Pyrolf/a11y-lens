import type { KeyboardEvent } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import type {
  AuditResult,
  AxeResultsPayload,
  ComputedStyleEntry,
} from '../../types/audit';
import type { TokenExtractionResult } from '../../types/tokens';
import type { LeftPanelTab, PreviewViewport, RightPanelTab } from '../../types/workspace';
import { DesignTokensTab } from '../tokens/DesignTokensTab';
import { TokenInsights } from '../tokens/TokenInsights';
import { AuditReport } from './AuditReport';
import { SandboxPreview } from './SandboxPreview';

interface PreviewAuditPanelProps {
  html: string;
  leftPanelTab: LeftPanelTab;
  tokenJson: string;
  tab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  auditResult: AuditResult | null;
  tokenResult: TokenExtractionResult | null;
  selectedIssueIds: string[];
  onToggleIssue: (issueId: string) => void;
  viewport: PreviewViewport;
  onViewportChange: (viewport: PreviewViewport) => void;
  onComputedStyles: (styles: ComputedStyleEntry[], html: string) => void;
  onAxeResults: (results: AxeResultsPayload, html: string) => void;
}

const viewportButtons: Array<{ id: PreviewViewport; label: string; Icon: typeof Monitor }> = [
  { id: 'desktop', label: 'Desktop', Icon: Monitor },
  { id: 'tablet', label: 'Tablet', Icon: Tablet },
  { id: 'mobile', label: 'Mobile', Icon: Smartphone },
];

const VIEWPORT_BADGE: Record<PreviewViewport, string> = {
  desktop: 'Desktop · Full width',
  tablet: 'Tablet · 768px',
  mobile: 'Mobile · 375px',
};

const REPORT_TABS: RightPanelTab[] = ['audit', 'tokens'];

export function PreviewAuditPanel({
  html,
  leftPanelTab,
  tokenJson,
  tab,
  onTabChange,
  auditResult,
  tokenResult,
  selectedIssueIds,
  onToggleIssue,
  viewport,
  onViewportChange,
  onComputedStyles,
  onAxeResults,
}: PreviewAuditPanelProps) {
  const handleReportTabKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = REPORT_TABS.indexOf(tab);
    const next = REPORT_TABS[(index + (event.key === 'ArrowRight' ? 1 : REPORT_TABS.length - 1)) % REPORT_TABS.length];
    onTabChange(next);
    document.getElementById(`report-tab-${next}`)?.focus();
  };

  const handleViewportKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextIndex =
      (index + (event.key === 'ArrowRight' ? 1 : viewportButtons.length - 1)) % viewportButtons.length;
    const next = viewportButtons[nextIndex];
    onViewportChange(next.id);
    document.getElementById(`viewport-${next.id}`)?.focus();
  };

  // The Design Tokens editor owns the right pane while it is active: no HTML
  // preview, HTML audit or extracted-DOM-token panes should remain visible.
  if (leftPanelTab === 'tokens') {
    return (
      <div className="flex h-full min-h-90 flex-col">
        <TokenInsights json={tokenJson} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-90 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            id="report-tab-audit"
            type="button"
            aria-pressed={tab === 'audit'}
            onClick={() => onTabChange('audit')}
            onKeyDown={handleReportTabKeys}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'audit' ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Audit
          </button>
          <button
            id="report-tab-tokens"
            type="button"
            aria-pressed={tab === 'tokens'}
            onClick={() => onTabChange('tokens')}
            onKeyDown={handleReportTabKeys}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'tokens' ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Extracted Tokens
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="viewport-width-badge"
            className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
          >
            {VIEWPORT_BADGE[viewport]}
          </span>
          <div
            role="group"
            aria-label="Preview viewport"
            className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/50 p-1"
          >
            {viewportButtons.map(({ id, label, Icon }, index) => (
              <button
                key={id}
                id={`viewport-${id}`}
                type="button"
                onClick={() => onViewportChange(id)}
                onKeyDown={(event) => handleViewportKeys(event, index)}
                className={`rounded p-1.5 ${viewport === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                aria-label={label}
                aria-pressed={viewport === id}
                title={label}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="shrink-0">
          <SandboxPreview
            html={html}
            viewport={viewport}
            title="Snippet preview sandbox"
            issueCount={auditResult?.issues.length}
            onComputedStyles={onComputedStyles}
            onAxeResults={onAxeResults}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {tab === 'audit' ? (
            <AuditReport
              result={auditResult}
              html={html}
              selectedIssueIds={selectedIssueIds}
              onToggleIssue={onToggleIssue}
            />
          ) : (
            <DesignTokensTab result={tokenResult} />
          )}
        </div>
      </div>
    </div>
  );
}

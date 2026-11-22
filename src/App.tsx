import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiFixDrawer } from './components/ai/AiFixDrawer';
import { EditorWorkbench } from './components/editor/EditorWorkbench';
import { SplitPane } from './components/layout/SplitPane';
import { WorkbenchShell } from './components/layout/WorkbenchShell';
import { PreviewAuditPanel } from './components/preview/PreviewAuditPanel';
import { useAiFix } from './hooks/useAiFix';
import { useAudit } from './hooks/useAudit';
import { useDesignTokens } from './hooks/useDesignTokens';
import { APP_NAME } from './lib/constants';
import { ALL_PRESETS, STARTER_PRESET, type SnippetPreset } from './lib/sampleSnippets';
import { SAMPLE_TOKEN_JSON } from './lib/sampleTokens';
import { decodeSharePayload, encodeSharePayload, getShareHash } from './lib/shareLink';
import type { AxeResultsPayload, ComputedStyleEntry } from './types/audit';
import type { CodeSnippet } from './types/editor';
import type {
  LeftPanelTab,
  PreviewViewport,
  RightPanelTab,
} from './types/workspace';

const CUSTOM_SNIPPET_ID = 'custom-snippet';
const LIVE_ANALYSIS_DELAY_MS = 250;

function createInitialSnippet(): CodeSnippet {
  const now = new Date().toISOString();
  return {
    id: STARTER_PRESET.id,
    name: STARTER_PRESET.name,
    language: 'html-tailwind',
    html: STARTER_PRESET.html,
    createdAt: now,
    updatedAt: now,
  };
}

export default function App() {
  // `snippet` drives the textarea instantly; `liveSnippet` is the debounced
  // version that drives the audit, iframe srcDoc and token extraction.
  const [snippet, setSnippet] = useState<CodeSnippet>(createInitialSnippet);
  const [liveSnippet, setLiveSnippet] = useState<CodeSnippet>(snippet);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('html');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('audit');
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop');
  const [tokenJson, setTokenJson] = useState(SAMPLE_TOKEN_JSON);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [previewStyles, setPreviewStyles] = useState<ComputedStyleEntry[]>([]);
  const [axeResults, setAxeResults] = useState<AxeResultsPayload>({ violations: [], passes: [] });
  // Snapshot styles/axe findings are tagged with the HTML that produced them.
  // If the source changes first, stale snapshot data is ignored until the new
  // frame reports.
  const previewStylesHtmlRef = useRef('');
  const axeResultsHtmlRef = useRef('');

  const { result: auditResult, run: runAudit } = useAudit();
  const { result: tokenResult, run: runTokens } = useDesignTokens();
  const ai = useAiFix();
  const cancelAiRequest = ai.cancel;

  useEffect(() => {
    const encoded = getShareHash();
    if (!encoded) return;
    let cancelled = false;
    decodeSharePayload(encoded).then((payload) => {
      if (cancelled || !payload) return;
      const now = new Date().toISOString();
      const sharedSnippet: CodeSnippet = {
        id: CUSTOM_SNIPPET_ID,
        name: 'Shared Snippet',
        language: 'html-tailwind',
        html: payload.html,
        createdAt: now,
        updatedAt: now,
      };
      setSnippet(sharedSnippet);
      setLiveSnippet(sharedSnippet);
      if (payload.tokenJson) setTokenJson(payload.tokenJson);
      setSelectedIssueIds([]);
      setRightPanelTab('audit');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleShare = useCallback(async () => {
    try {
      const encoded = await encodeSharePayload({ html: snippet.html, tokenJson });
      const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
    } finally {
      window.setTimeout(() => setShareStatus('idle'), 2000);
    }
  }, [snippet.html, tokenJson]);
  const analyze = useCallback(
    (
      target: CodeSnippet,
      computedStyles: ComputedStyleEntry[] = [],
      results: AxeResultsPayload = { violations: [], passes: [] },
    ) => {
      runAudit(target, computedStyles, results.violations, results.passes);
      runTokens(target, computedStyles);
    },
    [runAudit, runTokens],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setLiveSnippet(snippet), LIVE_ANALYSIS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [snippet]);

  // Re-runs on each debounced source update and again when the keyed iframe
  // posts matching computed-style and axe snapshots, so colors and axe coverage
  // track the preview.
  useEffect(() => {
    const styles = previewStylesHtmlRef.current === liveSnippet.html ? previewStyles : [];
    const results =
      axeResultsHtmlRef.current === liveSnippet.html
        ? axeResults
        : { violations: [], passes: [] };
    analyze(liveSnippet, styles, results);
  }, [analyze, axeResults, liveSnippet, previewStyles]);

  const selectedIssues = useMemo(
    () => (auditResult?.issues ?? []).filter((issue) => selectedIssueIds.includes(issue.id)),
    [auditResult?.issues, selectedIssueIds],
  );

  const handleComputedStyles = useCallback((styles: ComputedStyleEntry[], html: string) => {
    previewStylesHtmlRef.current = html;
    setPreviewStyles(styles);
  }, []);

  const handleAxeResults = useCallback((results: AxeResultsPayload, html: string) => {
    axeResultsHtmlRef.current = html;
    setAxeResults(results);
  }, []);

  // Abort any in-flight provider request, but keep a completed diff so the
  // user can close the drawer, inspect the editor, and reopen the result.
  const closeAiDrawer = useCallback(() => {
    cancelAiRequest();
    setIsAiDrawerOpen(false);
  }, [cancelAiRequest]);

  const handleSnippetChange = (html: string) => {
    setSnippet((prev) => ({
      ...prev,
      id: CUSTOM_SNIPPET_ID,
      name: 'Custom Snippet',
      html,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleRerunAudit = useCallback(() => {
    // Flush any pending debounced edit so the manual trigger is never a no-op.
    if (snippet.html === liveSnippet.html) {
      const styles = previewStylesHtmlRef.current === snippet.html ? previewStyles : [];
      const results =
        axeResultsHtmlRef.current === snippet.html
          ? axeResults
          : { violations: [], passes: [] };
      analyze(snippet, styles, results);
    } else {
      // The liveSnippet effect reruns the audit once the new frame mounts.
      setLiveSnippet(snippet);
    }
    setRightPanelTab('audit');
  }, [analyze, axeResults, liveSnippet.html, previewStyles, snippet]);

  const handleLoadPreset = (preset: SnippetPreset) => {
    const now = new Date().toISOString();
    const nextSnippet: CodeSnippet = {
      id: preset.id,
      name: preset.name,
      language: 'html-tailwind',
      html: preset.html,
      createdAt: now,
      updatedAt: now,
    };

    setSnippet(nextSnippet);
    setLiveSnippet(nextSnippet);
    setSelectedIssueIds([]);
    setRightPanelTab('audit');
    // A preset swap replaces the source under any in-flight fix; abort it so a
    // late response can never surface a diff for the previous snippet.
    ai.cancel();
    ai.clearResult();
  };

  const handleToggleIssue = (issueId: string) => {
    setSelectedIssueIds((prev) =>
      prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId],
    );
  };

  const handleRequestAiFix = async () => {
    await ai.requestFix({
      snippet,
      issues: selectedIssues.length > 0 ? selectedIssues : auditResult?.issues ?? [],
      instruction: 'Fix selected accessibility issues while preserving intent and Tailwind styling.',
    });
  };

  const handleRequestDemoFix = async () => {
    await ai.requestDemoFix({
      snippet,
      issues: selectedIssues.length > 0 ? selectedIssues : auditResult?.issues ?? [],
      instruction: 'Fix selected accessibility issues while preserving intent and Tailwind styling.',
    });
  };

  const handleApplyFix = () => {
    const patchedHtml = ai.state.result?.patchedHtml;
    if (!patchedHtml) return;
    const patchedSnippet: CodeSnippet = {
      ...snippet,
      html: patchedHtml,
      updatedAt: new Date().toISOString(),
    };
    setSnippet(patchedSnippet);
    setLiveSnippet(patchedSnippet);
    setIsAiDrawerOpen(false);
  };

  return (
    <WorkbenchShell
      header={
        <header className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-indigo-300">Client-Side WCAG Auditor</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">{APP_NAME}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Deterministic-first accessibility checks for HTML/Tailwind snippets. Preview is sandboxed in an iframe;
              AI fixes are optional via Demo mode or BYOK.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={handleShare}
              data-testid="share-link-button"
              className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-indigo-200 hover:border-indigo-400 hover:text-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              {shareStatus === 'copied'
                ? 'Link copied'
                : shareStatus === 'error'
                  ? 'Copy failed'
                  : 'Share link'}
            </button>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
              100% Client-Side
            </span>
            <span className="rounded-full border border-slate-700 px-2 py-1">sessionStorage BYOK</span>
          </div>
        </header>
      }
      drawer={
        <AiFixDrawer
          open={isAiDrawerOpen}
          onClose={closeAiDrawer}
          aiState={ai.state}
          providerId={ai.providerId}
          onProviderChange={ai.setProviderId}
          openRouterApiKey={ai.openRouterApiKey}
          onOpenRouterApiKeyChange={ai.setOpenRouterApiKey}
          openRouterModel={ai.openRouterModel}
          onOpenRouterModelChange={ai.setOpenRouterModel}
          unhealthyModels={ai.unhealthyModels}
          ollamaModel={ai.ollamaModel}
          onOllamaModelChange={ai.setOllamaModel}
          ollamaBaseUrl={ai.ollamaBaseUrl}
          onOllamaBaseUrlChange={ai.setOllamaBaseUrl}
          onRequestAiFix={handleRequestAiFix}
          onRequestDemoFix={handleRequestDemoFix}
          onApplyFix={handleApplyFix}
        />
      }
    >
      <SplitPane
        left={
          <EditorWorkbench
            activeTab={leftPanelTab}
            onTabChange={setLeftPanelTab}
            snippet={snippet}
            presets={ALL_PRESETS}
            onChange={handleSnippetChange}
            onRerunAudit={handleRerunAudit}
            onOpenAiFix={() => setIsAiDrawerOpen(true)}
            onLoadPreset={handleLoadPreset}
            tokenJson={tokenJson}
            onTokenJsonChange={setTokenJson}
            auditResult={auditResult}
          />
        }
        right={
          <PreviewAuditPanel
            html={liveSnippet.html}
            leftPanelTab={leftPanelTab}
            tokenJson={tokenJson}
            tab={rightPanelTab}
            onTabChange={setRightPanelTab}
            auditResult={auditResult}
            tokenResult={tokenResult}
            selectedIssueIds={selectedIssueIds}
            onToggleIssue={handleToggleIssue}
            viewport={previewViewport}
            onViewportChange={setPreviewViewport}
            onComputedStyles={handleComputedStyles}
            onAxeResults={handleAxeResults}
          />
        }
      />
    </WorkbenchShell>
  );
}

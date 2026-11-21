import type { KeyboardEvent } from 'react';
import type { AuditResult } from '../../types/audit';
import type { CodeSnippet } from '../../types/editor';
import type { SnippetPreset } from '../../lib/sampleSnippets';
import type { LeftPanelTab } from '../../types/workspace';
import { DesignTokensEditor } from '../tokens/DesignTokensEditor';
import { CodeEditorPane } from './CodeEditorPane';

interface EditorWorkbenchProps {
  activeTab: LeftPanelTab;
  onTabChange: (tab: LeftPanelTab) => void;
  snippet: CodeSnippet;
  presets: SnippetPreset[];
  onChange: (html: string) => void;
  onRerunAudit: () => void;
  onOpenAiFix: () => void;
  onLoadPreset: (preset: SnippetPreset) => void;
  tokenJson: string;
  onTokenJsonChange: (json: string) => void;
  auditResult: AuditResult | null;
}

const TABS: Array<{ id: LeftPanelTab; label: string }> = [
  { id: 'html', label: 'HTML Editor' },
  { id: 'tokens', label: 'Design Tokens' },
];

export function EditorWorkbench({
  activeTab,
  onTabChange,
  snippet,
  presets,
  onChange,
  onRerunAudit,
  onOpenAiFix,
  onLoadPreset,
  tokenJson,
  onTokenJsonChange,
  auditResult,
}: EditorWorkbenchProps) {
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight': nextIndex = (index + 1) % TABS.length; break;
      case 'ArrowLeft': nextIndex = (index - 1 + TABS.length) % TABS.length; break;
      case 'Home': nextIndex = 0; break;
      case 'End': nextIndex = TABS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const nextTab = TABS[nextIndex];
    onTabChange(nextTab.id);
    document.getElementById(`editor-tab-${nextTab.id}`)?.focus();
  };

  return (
    <div className="flex h-full min-h-90 flex-col">
      <div
        role="tablist"
        aria-label="Editor panels"
        className="flex gap-1 border-b border-slate-800 px-4 py-2"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`editor-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="editor-panel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            data-testid={`editor-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              activeTab === tab.id
                ? 'bg-slate-100 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id="editor-panel"
        role="tabpanel"
        aria-labelledby={`editor-tab-${activeTab}`}
        className="min-h-0 flex-1"
      >
        {activeTab === 'html' ? (
          <CodeEditorPane
            snippet={snippet}
            presets={presets}
            selectedPresetId={snippet.id}
            onChange={onChange}
            onRerunAudit={onRerunAudit}
            onOpenAiFix={onOpenAiFix}
            onLoadPreset={onLoadPreset}
          />
        ) : (
          <DesignTokensEditor
            value={tokenJson}
            onChange={onTokenJsonChange}
            auditResult={auditResult}
          />
        )}
      </div>
    </div>
  );
}

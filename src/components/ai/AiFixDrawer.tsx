import { useEffect, useRef } from 'react';
import { Loader2, Sparkles, Wand2, X } from 'lucide-react';
import type { AiState, AiProviderId } from '../../types/ai';
import { FixDiffView } from './FixDiffView';
import { ProviderSettings } from './ProviderSettings';

interface AiFixDrawerProps {
  open: boolean;
  onClose: () => void;
  aiState: AiState;
  providerId: AiProviderId;
  onProviderChange: (id: AiProviderId) => void;
  openRouterApiKey: string;
  onOpenRouterApiKeyChange: (value: string) => void;
  openRouterModel: string;
  onOpenRouterModelChange: (value: string) => void;
  unhealthyModels: string[];
  ollamaModel: string;
  onOllamaModelChange: (value: string) => void;
  ollamaBaseUrl: string;
  onOllamaBaseUrlChange: (value: string) => void;
  onRequestAiFix: () => void;
  onRequestDemoFix: () => void;
  onApplyFix: () => void;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AiFixDrawer({
  open,
  onClose,
  aiState,
  providerId,
  onProviderChange,
  openRouterApiKey,
  onOpenRouterApiKeyChange,
  openRouterModel,
  onOpenRouterModelChange,
  unhealthyModels,
  ollamaModel,
  onOllamaModelChange,
  ollamaBaseUrl,
  onOllamaBaseUrlChange,
  onRequestAiFix,
  onRequestDemoFix,
  onApplyFix,
}: AiFixDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Modal keyboard behaviour: focus moves in, Tab cycles inside, Escape exits.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = drawerRef.current;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  const isLoading = aiState.status === 'loading';
  const isDemoLoading = isLoading && aiState.providerId === 'demo';
  const isByokLoading = isLoading && aiState.providerId !== 'demo';
  const hasResult = Boolean(aiState.result);
  // While a rate-limit banner is shown, its inline button is the only demo
  // action so assistive-tech users don't get two identically named controls.
  const showErrorDemoFallback = aiState.errorSuggestsDemoFix === true;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60">
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI Fix Drawer"
        data-testid="ai-fix-drawer"
        className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-800 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300">BYOK / Demo AI</p>
            <h2 className="text-lg font-semibold text-slate-100">AI Auto-Fix</h2>
            <p className="text-sm text-slate-400">
              Deterministic audit findings come first. AI suggestions are optional, reviewable, and never auto-applied.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
            aria-label="Close AI fix drawer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          {!showErrorDemoFallback && (
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-100">Try the fix flow with no setup</p>
                  <p className="text-xs text-indigo-200">
                    Runs a deterministic local refactor and shows a reviewable diff. No API key, no network call.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRequestDemoFix}
                  data-testid="demo-ai-fix-button"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isDemoLoading ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Wand2 size={16} aria-hidden="true" />
                  )}
                  {isDemoLoading ? 'Generating Demo Fix...' : 'Try Demo AI Fix (No Key Required)'}
                </button>
              </div>
            </div>
          )}

          <ProviderSettings
            providerId={providerId}
            onProviderChange={onProviderChange}
            openRouterApiKey={openRouterApiKey}
            onOpenRouterApiKeyChange={onOpenRouterApiKeyChange}
            openRouterModel={openRouterModel}
            onOpenRouterModelChange={onOpenRouterModelChange}
            unhealthyModels={unhealthyModels}
            ollamaModel={ollamaModel}
            onOllamaModelChange={onOllamaModelChange}
            ollamaBaseUrl={ollamaBaseUrl}
            onOllamaBaseUrlChange={onOllamaBaseUrlChange}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRequestAiFix}
              data-testid="generate-ai-fix-button"
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isByokLoading ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={16} aria-hidden="true" />
              )}
              {isByokLoading
                ? 'Generating WCAG Fix...'
                : providerId === 'demo'
                  ? 'Generate Demo Fix'
                  : `Generate Fix with ${providerId === 'openrouter' ? 'OpenRouter' : 'Ollama'}`}
            </button>
            <button
              type="button"
              onClick={onApplyFix}
              data-testid="apply-ai-fix-button"
              disabled={!hasResult || isLoading}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              Apply Fix to Editor
            </button>
          </div>

          {isLoading && (
            <p
              role="status"
              aria-live="polite"
              data-testid="ai-fix-loading-status"
              className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400"
            >
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {isDemoLoading
                ? 'Generating a deterministic demo fix...'
                : `Generating a WCAG fix with ${aiState.providerId === 'openrouter' ? 'OpenRouter' : 'Ollama'}... This may take a moment.`}
            </p>
          )}

          {aiState.error && (
            <div role="alert" data-testid="ai-fix-error" className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              <p>{aiState.error}</p>
              {showErrorDemoFallback && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onRequestDemoFix}
                    data-testid="rate-limit-demo-fix-button"
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-md bg-rose-200 px-3 py-2 text-sm font-semibold text-rose-950 hover:bg-white disabled:opacity-50"
                  >
                    {isDemoLoading ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Wand2 size={16} aria-hidden="true" />
                    )}
                    Try Demo AI Fix (No Key Required)
                  </button>
                  <span className="text-xs text-rose-200/80">No key, no network call — runs entirely in this browser.</span>
                </div>
              )}
            </div>
          )}

          {aiState.result && (
            <div className="space-y-3" data-testid="ai-fix-result">
              <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-sm font-medium text-slate-100">{aiState.result.summary}</p>
                {aiState.result.warnings.length > 0 && (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-200">
                    {aiState.result.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-slate-200">Before / After Diff</h3>
                  <span className="text-xs text-slate-400">Review before applying</span>
                </div>
                <FixDiffView diff={aiState.result.diff} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

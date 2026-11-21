import { useCallback, useMemo, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import {
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  OLLAMA_BASE_URL,
} from '../../lib/constants';
import type { FreeModelOption } from '../../engine/ai/openRouterModels';
import {
  mergeOllamaModels,
  normalizeOllamaBaseUrl,
  OLLAMA_CUSTOM_MODEL_VALUE,
} from '../../engine/ai/ollamaModels';
import { useModelDiscovery } from '../../hooks/useModelDiscovery';
import type { AiProviderId } from '../../types/ai';

/** One shared class string so Provider and Model selects render with identical styling. */
const SELECT_CLASS =
  'w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-100 focus:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500';

const CUSTOM_MODEL_VALUE = '__custom__';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  testId: string;
};

/** Reusable wrapper that renders the exact same select markup + chevron for both fields. */
function SelectField({ children, testId, className = SELECT_CLASS, ...selectProps }: SelectFieldProps) {
  return (
    <div className="relative">
      <select {...selectProps} data-testid={testId} className={className}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

/** Model select plus a subtle, provider-aware discovery refresh control. */
function ModelSelectRow({
  children,
  onRefresh,
  refreshing,
  refreshLabel,
}: {
  children: ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
  refreshLabel: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        data-testid="refresh-models-button"
        aria-label={refreshLabel}
        title={refreshLabel}
        className="mt-0.5 shrink-0 rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-400 hover:border-indigo-500 hover:text-indigo-200 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50"
      >
        <RefreshCw size={16} className={refreshing ? 'animate-spin' : undefined} aria-hidden="true" />
      </button>
    </div>
  );
}

function openRouterModelLabel(model: FreeModelOption, unhealthyModels: string[]): string {
  return unhealthyModels.includes(model.id) ? `${model.label} (Rate-limited)` : model.label;
}

function ollamaOptionLabel(model: string): string {
  return model === DEFAULT_OLLAMA_MODEL ? `${model} (Recommended)` : model;
}

interface ProviderSettingsProps {
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
}

export function ProviderSettings({
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
}: ProviderSettingsProps) {
  const {
    freeModels,
    openRouterStatus,
    ollamaStatus,
    detectedOllamaModels,
    discoveringOllama,
    refreshing,
    beginOllamaDiscovery,
    cancelOpenRouterRefresh,
    refresh,
  } = useModelDiscovery(providerId, ollamaBaseUrl);

  const handleProviderChange = useCallback(
    (id: AiProviderId) => {
      if (id === 'ollama') beginOllamaDiscovery();
      if (id !== 'openrouter') cancelOpenRouterRefresh();
      onProviderChange(id);
    },
    [beginOllamaDiscovery, cancelOpenRouterRefresh, onProviderChange],
  );

  const handleOllamaBaseUrlChange = useCallback(
    (value: string) => {
      beginOllamaDiscovery();
      onOllamaBaseUrlChange(value);
    },
    [beginOllamaDiscovery, onOllamaBaseUrlChange],
  );

  // Memoized option objects keep the <select> subtree stable while the user
  // opens it or types elsewhere in the drawer.
  const openRouterOptions = useMemo(
    () =>
      freeModels.map((model) => ({
        value: model.id,
        label: openRouterModelLabel(model, unhealthyModels),
      })),
    [freeModels, unhealthyModels],
  );
  const isPresetModel = useMemo(
    () => freeModels.some((model) => model.id === openRouterModel),
    [freeModels, openRouterModel],
  );
  const modelSelectValue = isPresetModel ? openRouterModel : CUSTOM_MODEL_VALUE;

  const normalizedOllamaBaseUrl = useMemo(() => normalizeOllamaBaseUrl(ollamaBaseUrl), [ollamaBaseUrl]);
  const ollamaEndpointLabel = normalizedOllamaBaseUrl.replace(/^https?:\/\//, '');

  // Connected Ollama installs show only models actually returned by /api/tags;
  // suggestions are shown exclusively while discovery is unavailable.
  const ollamaOptions = useMemo(() => {
    const activeModels = ollamaStatus === 'connected' ? detectedOllamaModels : mergeOllamaModels([]);
    return activeModels.map((model) => ({ value: model, label: ollamaOptionLabel(model) }));
  }, [detectedOllamaModels, ollamaStatus]);
  const isPresetOllamaModel = useMemo(
    () => ollamaOptions.some((option) => option.value === ollamaModel),
    [ollamaModel, ollamaOptions],
  );
  const ollamaModelSelectValue = isPresetOllamaModel ? ollamaModel : OLLAMA_CUSTOM_MODEL_VALUE;
  const hasDetectedModels = ollamaStatus === 'connected';
  const ollamaSourceLabel = hasDetectedModels
    ? 'Installed local models (Detected)'
    : 'Suggested models (Ollama not connected)';

  const openRouterHint =
    openRouterStatus === 'loading'
      ? 'Discovering $0 models from the public OpenRouter catalog...'
      : openRouterStatus === 'ready'
        ? 'Smart-ranked $0 models: coding/agentic affinity first, then largest context window.'
        : openRouterStatus === 'cache'
          ? 'Using the cached OpenRouter catalog. Refresh to check for new free models.'
          : 'Live catalog unavailable — showing curated $0 picks and openrouter/free. Refresh to retry.';
  const openRouterSourceLabel =
    openRouterStatus === 'loading'
      ? 'Free models (Discovering...)'
      : openRouterStatus === 'ready'
        ? 'Free models (Live catalog)'
        : openRouterStatus === 'cache'
          ? 'Free models (Cached catalog)'
          : 'Suggested free models (Catalog unavailable)';

  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div>
        <label htmlFor="ai-provider-select" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Provider</label>
        <SelectField
          id="ai-provider-select"
          testId="ai-provider-select"
          value={providerId}
          onChange={(e) => handleProviderChange(e.target.value as AiProviderId)}
        >
          <option value="demo">Demo AI Fix (No Key Required)</option>
          <option value="openrouter">OpenRouter (BYOK)</option>
          <option value="ollama">Ollama (Local)</option>
        </SelectField>
      </div>

      {providerId === 'openrouter' && (
        <>
          <div>
            <label htmlFor="openrouter-key" className="mb-1 block text-xs text-slate-400">OpenRouter API Key (sessionStorage only)</label>
            <input
              id="openrouter-key"
              data-testid="openrouter-key-input"
              type="password"
              value={openRouterApiKey}
              onChange={(e) => onOpenRouterApiKeyChange(e.target.value)}
              placeholder="sk-or-..."
              autoComplete="off"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-400">Stored only in sessionStorage for this tab session.</p>
          </div>
          <div>
            <label htmlFor="openrouter-model" className="mb-1 block text-xs text-slate-400">Model</label>
            <ModelSelectRow
              onRefresh={refresh}
              refreshing={refreshing}
              refreshLabel="Refresh OpenRouter models"
            >
              <SelectField
                id="openrouter-model"
                testId="openrouter-model-select"
                value={modelSelectValue}
                onChange={(e) => {
                  if (e.target.value === CUSTOM_MODEL_VALUE) {
                    // Keep any previously chosen custom slug (or fall back to a blank slug)
                    // when the user switches to "Custom model ID..." so no keystrokes are lost.
                    if (!isPresetModel) return;
                    onOpenRouterModelChange('');
                  } else {
                    onOpenRouterModelChange(e.target.value);
                  }
                }}
                aria-describedby="openrouter-model-hint"
              >
                <optgroup label={openRouterSourceLabel}>
                  {openRouterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                <option value={CUSTOM_MODEL_VALUE}>Custom model ID...</option>
              </SelectField>
            </ModelSelectRow>
            {!isPresetModel && (
              <div className="mt-2">
                <label htmlFor="openrouter-custom-model" className="mb-1 block text-xs text-slate-400">Custom model ID</label>
                <input
                  id="openrouter-custom-model"
                  data-testid="openrouter-custom-model-input"
                  type="text"
                  value={openRouterModel}
                  onChange={(e) => onOpenRouterModelChange(e.target.value)}
                  placeholder={DEFAULT_OPENROUTER_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="openrouter-model-hint"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500"
                />
              </div>
            )}
            <p
              id="openrouter-model-hint"
              data-testid="openrouter-model-hint"
              className="mt-1 text-xs text-slate-400"
            >
              {openRouterHint}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Pinned first: <code className="text-indigo-200">{DEFAULT_OPENROUTER_MODEL}</code>. Chronically
              rate-limited families (google/, inclusionai/) are hidden; use{' '}
              <span className="text-indigo-200">Custom model ID...</span> to type any slug manually.
            </p>
          </div>
        </>
      )}

      {providerId === 'ollama' && (
        <>
          <div>
            <label htmlFor="ollama-base-url" className="mb-1 block text-xs text-slate-400">Ollama Base URL</label>
            <input
              id="ollama-base-url"
              data-testid="ollama-base-url-input"
              type="text"
              value={ollamaBaseUrl}
              onChange={(e) => handleOllamaBaseUrlChange(e.target.value)}
              placeholder={OLLAMA_BASE_URL}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              Local endpoint used for model discovery and generation. Default: <code className="text-indigo-200">{OLLAMA_BASE_URL}</code>
            </p>
          </div>
          <div>
            <label htmlFor="ollama-model" className="mb-1 block text-xs text-slate-400">Ollama Model</label>
            <ModelSelectRow
              onRefresh={refresh}
              refreshing={refreshing}
              refreshLabel="Refresh Ollama models"
            >
              <SelectField
                id="ollama-model"
                testId="ollama-model-select"
                value={ollamaModelSelectValue}
                onChange={(e) => {
                  if (e.target.value === OLLAMA_CUSTOM_MODEL_VALUE) {
                    if (!isPresetOllamaModel) return;
                    onOllamaModelChange('');
                  } else {
                    onOllamaModelChange(e.target.value);
                  }
                }}
                aria-describedby="ollama-model-hint"
              >
                <optgroup label={ollamaSourceLabel}>
                  {ollamaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                <option value={OLLAMA_CUSTOM_MODEL_VALUE}>Custom model ID...</option>
              </SelectField>
            </ModelSelectRow>
            {!isPresetOllamaModel && (
              <div className="mt-2">
                <label htmlFor="ollama-custom-model" className="mb-1 block text-xs text-slate-400">Custom model ID</label>
                <input
                  id="ollama-custom-model"
                  data-testid="ollama-model-input"
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => onOllamaModelChange(e.target.value)}
                  placeholder={DEFAULT_OLLAMA_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="ollama-model-hint"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500"
                />
              </div>
            )}
            <div id="ollama-model-hint" className="mt-1 space-y-1">
              {discoveringOllama ? (
                <p className="text-xs text-slate-400">
                  Detecting installed models from {normalizedOllamaBaseUrl}/api/tags...
                </p>
              ) : (
                <>
                  <p
                    data-testid="ollama-model-source"
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      hasDetectedModels
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    }`}
                  >
                    {ollamaSourceLabel}
                  </p>
                  {!hasDetectedModels && (
                    <p
                      role="status"
                      data-testid="ollama-status-pill"
                      className="text-xs text-amber-200"
                    >
                      {`Ollama not detected at ${ollamaEndpointLabel} — start Ollama with OLLAMA_ORIGINS="*" or use Try Demo AI Fix.`}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

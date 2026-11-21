import { useCallback, useEffect, useRef, useState } from 'react';
import { createDemoFix } from '../engine/ai/providers/demo';
import { createOllamaFix } from '../engine/ai/providers/ollama';
import { createOpenRouterFix, OpenRouterRateLimitError } from '../engine/ai/providers/openRouter';
import {
  DEFAULT_AI_PROVIDER_ID,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  OLLAMA_BASE_URL,
  OPENROUTER_BASE_URL,
  SESSION_STORAGE_KEYS,
} from '../lib/constants';
import type { AiFixRequest, AiProviderConfig, AiState } from '../types/ai';
import { useSessionStorage } from './useSessionStorage';

function normalizeOllamaBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || OLLAMA_BASE_URL;
}

function createProviderConfig(
  providerId: AiProviderConfig['id'],
  openRouterApiKey: string,
  openRouterModel: string,
  ollamaModel: string,
  ollamaBaseUrl: string,
): AiProviderConfig {
  if (providerId === 'openrouter') {
    return {
      id: 'openrouter',
      label: 'OpenRouter',
      requiresKey: true,
      apiKey: openRouterApiKey,
      model: openRouterModel || DEFAULT_OPENROUTER_MODEL,
      baseUrl: OPENROUTER_BASE_URL,
    };
  }
  if (providerId === 'ollama') {
    return {
      id: 'ollama',
      label: 'Ollama',
      requiresKey: false,
      model: ollamaModel || DEFAULT_OLLAMA_MODEL,
      baseUrl: normalizeOllamaBaseUrl(ollamaBaseUrl),
    };
  }
  return { id: 'demo', label: 'Demo AI Fix', requiresKey: false };
}

export function useAiFix() {
  const [providerId, setProviderId] = useSessionStorage(
    SESSION_STORAGE_KEYS.aiProviderId,
    DEFAULT_AI_PROVIDER_ID,
  );
  const [openRouterApiKey, setOpenRouterApiKey] = useSessionStorage(
    SESSION_STORAGE_KEYS.openRouterApiKey,
    '',
  );
  const [openRouterModel, setOpenRouterModel] = useSessionStorage(
    SESSION_STORAGE_KEYS.openRouterModel,
    DEFAULT_OPENROUTER_MODEL,
  );
  const [ollamaModel, setOllamaModel] = useSessionStorage(
    SESSION_STORAGE_KEYS.ollamaModel,
    DEFAULT_OLLAMA_MODEL,
  );
  const [ollamaBaseUrl, setOllamaBaseUrl] = useSessionStorage<string>(
    SESSION_STORAGE_KEYS.ollamaBaseUrl,
    OLLAMA_BASE_URL,
  );

  const [state, setState] = useState<AiState>({
    providerId: DEFAULT_AI_PROVIDER_ID,
    status: 'idle',
  });
  // Session-scoped health registry: any model that answers 429/404 is flagged
  // in the dropdown until the tab is reloaded.
  const [unhealthyModels, setUnhealthyModels] = useState<string[]>([]);
  // Only the newest request may write state; superseded requests are aborted.
  const abortRef = useRef<AbortController | null>(null);

  const markModelUnhealthy = useCallback((model: string, _status: 429 | 404) => {
    setUnhealthyModels((previous) => (previous.includes(model) ? previous : [...previous, model]));
  }, []);

  const cancel = useCallback(() => {
    const controller = abortRef.current;
    if (!controller) return;
    abortRef.current = null;
    controller.abort();
    // Keep a completed diff; only an in-flight request collapses back to idle.
    setState((previous) =>
      previous.status === 'loading' ? { providerId: previous.providerId, status: 'idle' } : previous,
    );
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const requestFix = useCallback(
    async (request: Omit<AiFixRequest, 'provider'>, providerOverride?: AiProviderConfig['id']) => {
      const activeProvider = createProviderConfig(
        providerOverride ?? providerId,
        openRouterApiKey,
        openRouterModel,
        ollamaModel,
        ollamaBaseUrl,
      );

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ providerId: activeProvider.id, status: 'loading' });

      try {
        const fullRequest: AiFixRequest = { ...request, provider: activeProvider };
        const result =
          activeProvider.id === 'demo'
            ? await createDemoFix(fullRequest)
            : activeProvider.id === 'openrouter'
              ? await createOpenRouterFix(fullRequest, markModelUnhealthy, controller.signal)
              : await createOllamaFix(fullRequest, controller.signal);

        if (controller.signal.aborted) return;
        setState({ providerId: activeProvider.id, status: 'success', result });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          providerId: activeProvider.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'AI fix failed.',
          errorSuggestsDemoFix: error instanceof OpenRouterRateLimitError,
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [markModelUnhealthy, ollamaBaseUrl, ollamaModel, openRouterApiKey, openRouterModel, providerId],
  );

  const requestDemoFix = useCallback(
    async (request: Omit<AiFixRequest, 'provider'>) => {
      // The banner button always means demo mode: switch the modal's active
      // provider so the select stays in sync, then generate the diff immediately.
      setProviderId('demo');
      await requestFix(request, 'demo');
    },
    [requestFix, setProviderId],
  );

  return {
    state,
    providerId,
    setProviderId,
    openRouterApiKey,
    setOpenRouterApiKey,
    openRouterModel,
    setOpenRouterModel,
    ollamaModel,
    setOllamaModel,
    ollamaBaseUrl,
    setOllamaBaseUrl,
    unhealthyModels,
    requestFix,
    requestDemoFix,
    cancel,
    clearResult: () => setState((prev) => ({ ...prev, status: 'idle', error: undefined, result: undefined })),
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  discoverOpenRouterFreeModels,
  getCuratedFreeModels,
  type FreeModelOption,
} from '../engine/ai/openRouterModels';
import { discoverOllamaModels, type OllamaDiscoveryStatus } from '../engine/ai/ollamaModels';
import type { AiProviderId } from '../types/ai';

type OpenRouterDiscoveryStatus = 'loading' | 'ready' | 'cache' | 'fallback';

const URL_DEBOUNCE_MS = 300;

/**
 * Owns model discovery for the AI settings UI. This hook is mounted only while
 * the drawer is open, so each effect has exactly one trigger: mount, an explicit
 * provider/URL change, or a refresh press. Dependencies are primitives only.
 */
export function useModelDiscovery(providerId: AiProviderId, ollamaBaseUrl: string) {
  const [freeModels, setFreeModels] = useState<FreeModelOption[]>(getCuratedFreeModels);
  const [openRouterStatus, setOpenRouterStatus] = useState<OpenRouterDiscoveryStatus>('loading');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaDiscoveryStatus>('offline');
  const [detectedOllamaModels, setDetectedOllamaModels] = useState<string[]>([]);
  const [discoveringOllama, setDiscoveringOllama] = useState(providerId === 'ollama');
  const [openRouterRefreshNonce, setOpenRouterRefreshNonce] = useState(0);
  const [ollamaRefreshNonce, setOllamaRefreshNonce] = useState(0);
  const [openRouterRefreshing, setOpenRouterRefreshing] = useState(false);
  const handledOllamaRefreshNonce = useRef(0);

  // OpenRouter has no user-editable endpoint: discover once per modal open,
  // then only when the refresh button explicitly bumps the numeric nonce.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const force = openRouterRefreshNonce > 0;

    void discoverOpenRouterFreeModels({ signal: controller.signal, force })
      .then(({ models, source }) => {
        if (!active) return;
        setFreeModels(models);
        setOpenRouterStatus(source === 'fallback' ? 'fallback' : source === 'cache' ? 'cache' : 'ready');
      })
      .catch(() => {
        if (!active) return;
        setFreeModels(getCuratedFreeModels());
        setOpenRouterStatus('fallback');
      })
      .finally(() => {
        if (active) setOpenRouterRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [openRouterRefreshNonce]);

  // Ollama has a user-editable endpoint. URL typing is debounced for 300ms and
  // every superseded request is aborted, so only the final URL is fetched.
  // No state setter, object, or function reference appears in the dependencies.
  useEffect(() => {
    if (providerId !== 'ollama') return;

    let active = true;
    const controller = new AbortController();

    const isExplicitRefresh = ollamaRefreshNonce > handledOllamaRefreshNonce.current;
    handledOllamaRefreshNonce.current = ollamaRefreshNonce;

    const timer = window.setTimeout(() => {
      void discoverOllamaModels(ollamaBaseUrl, controller.signal)
        .then(({ status, models }) => {
          if (!active) return;
          setOllamaStatus(status);
          setDetectedOllamaModels(models);
        })
        .catch(() => {
          if (!active) return;
          setOllamaStatus('offline');
          setDetectedOllamaModels([]);
        })
        .finally(() => {
          if (active) setDiscoveringOllama(false);
        });
    }, isExplicitRefresh ? 0 : URL_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [ollamaBaseUrl, ollamaRefreshNonce, providerId]);

  // State resets live in event handlers, never inside effects, so discovery
  // results are cleared at the exact interaction that supersedes them.
  const beginOllamaDiscovery = useCallback(() => {
    setDiscoveringOllama(true);
    setOllamaStatus('offline');
    setDetectedOllamaModels([]);
  }, []);

  const cancelOpenRouterRefresh = useCallback(() => setOpenRouterRefreshing(false), []);

  const refresh = useCallback(() => {
    if (providerId === 'openrouter') {
      setOpenRouterRefreshing(true);
      setOpenRouterRefreshNonce((nonce) => nonce + 1);
    } else if (providerId === 'ollama') {
      beginOllamaDiscovery();
      setOllamaRefreshNonce((nonce) => nonce + 1);
    }
  }, [beginOllamaDiscovery, providerId]);

  const isDiscoveringOllama = providerId === 'ollama' && discoveringOllama;

  return {
    freeModels,
    openRouterStatus,
    ollamaStatus,
    detectedOllamaModels,
    discoveringOllama: isDiscoveringOllama,
    refreshing: providerId === 'openrouter' ? openRouterRefreshing : isDiscoveringOllama,
    beginOllamaDiscovery,
    cancelOpenRouterRefresh,
    refresh,
  };
}

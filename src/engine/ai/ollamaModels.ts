import { DEFAULT_OLLAMA_MODEL, OLLAMA_FALLBACK_MODELS } from '../../lib/constants';

interface OllamaTagModel {
  name?: string;
}

interface OllamaTagsResponse {
  models?: OllamaTagModel[];
}

export const OLLAMA_CUSTOM_MODEL_VALUE = '__ollama_custom__';

/** Explicit discovery states so the UI never claims fallback models are installed. */
export type OllamaDiscoveryStatus = 'connected' | 'empty' | 'offline';

interface OllamaDiscoveryResult {
  status: OllamaDiscoveryStatus;
  /** Names actually returned by /api/tags; empty for the empty/offline states. */
  models: string[];
}

export function normalizeOllamaBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || 'http://localhost:11434';
}

function normalizeModelName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed ? trimmed : null;
}

export function mergeOllamaModels(liveModels: string[]): string[] {
  const merged = [...liveModels, ...OLLAMA_FALLBACK_MODELS, DEFAULT_OLLAMA_MODEL];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const model of merged) {
    const normalized = model.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/**
 * Probes GET /api/tags and reports whether real local models were detected.
 * Network/CORS/HTTP failures are reported as 'offline'; an empty successful
 * response is reported as 'empty'. Only 'connected' means models are installed.
 */
export async function discoverOllamaModels(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<OllamaDiscoveryResult> {
  const normalizedBaseUrl = normalizeOllamaBaseUrl(baseUrl);

  try {
    const response = await fetch(`${normalizedBaseUrl}/api/tags`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!response.ok) return { status: 'offline', models: [] };

    const payload = (await response.json()) as OllamaTagsResponse;
    const data = Array.isArray(payload.models) ? payload.models : [];
    const models = data
      .map((model) => normalizeModelName(model.name))
      .filter((name): name is string => Boolean(name));

    return models.length > 0 ? { status: 'connected', models } : { status: 'empty', models: [] };
  } catch (error) {
    // Let callers abort cleanly on unmount/refresh; every other failure means
    // Ollama is unreachable (including CORS blocks) and only suggestions apply.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { status: 'offline', models: [] };
  }
}

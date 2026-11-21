import {
  DEFAULT_OPENROUTER_MODEL,
  HIGH_CONGESTION_OPENROUTER_FAMILIES,
  OPENROUTER_CODING_AFFINITY_TERMS,
  OPENROUTER_FREE_MODELS,
  OPENROUTER_MODELS_URL,
} from '../../lib/constants';

export interface OpenRouterCatalogModel {
  id: string;
  name: string;
  contextLength?: number;
}

export interface FreeModelOption extends OpenRouterCatalogModel {
  /** Ready-to-render <option> text, e.g. "Nemotron 3.5 Lightning (Free · 1M ctx)". */
  label: string;
}

export interface OpenRouterDiscoveryResult {
  models: FreeModelOption[];
  source: 'live' | 'cache' | 'fallback';
}

export interface FetchOpenRouterModelsOptions {
  signal?: AbortSignal;
  /** Skip the in-memory catalog cache (used by the refresh button). */
  force?: boolean;
}

interface OpenRouterModelPricing {
  prompt?: string | number;
  completion?: string | number;
}

interface OpenRouterModelRecord {
  id?: string;
  name?: string;
  context_length?: number;
  pricing?: OpenRouterModelPricing;
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModelRecord[];
}

type DiscoveredModel = OpenRouterCatalogModel & {
  promptPrice?: string | number;
  completionPrice?: string | number;
};

const AUTO_ROUTER_LABEL = 'Free Models Auto-Router (Recommended) — openrouter/free';
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Curated context windows keep the offline fallback useful without a network call. */
const CURATED_MODEL_DETAILS: Record<string, { name: string; contextLength?: number }> = {
  [DEFAULT_OPENROUTER_MODEL]: { name: 'Free Models Auto-Router (Recommended)' },
  'nvidia/nemotron-3-ultra-550b-a55b:free': { name: 'Nemotron 3 Ultra 550B A55B', contextLength: 262_144 },
  'nvidia/nemotron-3.5-lightning:free': { name: 'Nemotron 3.5 Lightning', contextLength: 1_000_000 },
  'liquid/lfm-3-1.7b:free': { name: 'LFM 3 1.7B', contextLength: 128_000 },
};

let cachedModels: FreeModelOption[] | null = null;
let cachedAt = 0;

function isZeroPrice(value: string | number | undefined): boolean {
  return (typeof value === 'string' && value.trim() === '0') || (typeof value === 'number' && value === 0);
}

function normalizeModelId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  return trimmed ? trimmed : null;
}

/** True for upstream families we keep out of the default recruiter-facing list. */
function isHighCongestionModel(id: string): boolean {
  const normalized = id.trim().toLowerCase();
  return HIGH_CONGESTION_OPENROUTER_FAMILIES.some((prefix) => normalized.startsWith(prefix));
}

/** "nvidia/nemotron-3.5-lightning:free" -> "Nemotron 3.5 Lightning". */
function deriveDisplayName(id: string): string {
  const slug = id.split('/').at(-1)?.replace(/:free$/i, '') ?? id;
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Compact context window label used in dropdown options. */
function formatContextLength(contextLength?: number): string | null {
  if (!contextLength || !Number.isFinite(contextLength) || contextLength <= 0) return null;
  if (contextLength >= 1_000_000) {
    const millions = contextLength / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (contextLength >= 1_000) return `${Math.round(contextLength / 1_000)}K`;
  return String(contextLength);
}

function buildOptionLabel(model: OpenRouterCatalogModel): string {
  if (model.id === DEFAULT_OPENROUTER_MODEL) return AUTO_ROUTER_LABEL;
  const context = formatContextLength(model.contextLength);
  return context ? `${model.name} (Free · ${context} ctx)` : `${model.name} (Free)`;
}

function withLabel(model: OpenRouterCatalogModel): FreeModelOption {
  return { ...model, label: buildOptionLabel(model) };
}

function affinityRank(model: OpenRouterCatalogModel): number {
  const haystack = `${model.id} ${model.name}`.toLowerCase();
  const index = OPENROUTER_CODING_AFFINITY_TERMS.findIndex((term) => haystack.includes(term));
  return index === -1 ? OPENROUTER_CODING_AFFINITY_TERMS.length : index;
}

/**
 * Pin the $0 auto-router first, then coding/agentic families, then the largest
 * context window. Ties fall back to a stable id sort so the list never jitters.
 */
function rankFreeModels(models: OpenRouterCatalogModel[]): OpenRouterCatalogModel[] {
  return [...models].sort((a, b) => {
    if (a.id === DEFAULT_OPENROUTER_MODEL) return b.id === DEFAULT_OPENROUTER_MODEL ? 0 : -1;
    if (b.id === DEFAULT_OPENROUTER_MODEL) return 1;

    const affinityDelta = affinityRank(a) - affinityRank(b);
    if (affinityDelta !== 0) return affinityDelta;

    const contextDelta = (b.contextLength ?? 0) - (a.contextLength ?? 0);
    if (contextDelta !== 0) return contextDelta;

    return a.id.localeCompare(b.id);
  });
}

function uniqueModels(models: OpenRouterCatalogModel[]): OpenRouterCatalogModel[] {
  const seen = new Set<string>();
  const unique: OpenRouterCatalogModel[] = [];
  for (const model of models) {
    if (!model.id || seen.has(model.id) || isHighCongestionModel(model.id)) continue;
    seen.add(model.id);
    unique.push(model);
  }
  return unique;
}

/** Curated zero-cost picks used when the public catalog cannot be reached. */
export function getCuratedFreeModels(): FreeModelOption[] {
  const models = OPENROUTER_FREE_MODELS.map((id) => {
    const details = CURATED_MODEL_DETAILS[id];
    return {
      id,
      name: details?.name ?? deriveDisplayName(id),
      contextLength: details?.contextLength,
    } satisfies OpenRouterCatalogModel;
  });
  return rankFreeModels(models).map(withLabel);
}

function toDiscoveredModel(record: OpenRouterModelRecord): DiscoveredModel | null {
  const id = normalizeModelId(record.id);
  if (!id) return null;
  const contextLength =
    typeof record.context_length === 'number' && Number.isFinite(record.context_length) && record.context_length > 0
      ? record.context_length
      : undefined;
  return {
    id,
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : deriveDisplayName(id),
    contextLength,
    promptPrice: record.pricing?.prompt,
    completionPrice: record.pricing?.completion,
  };
}

function normalizeOptions(input?: AbortSignal | FetchOpenRouterModelsOptions): FetchOpenRouterModelsOptions {
  if (!input) return {};
  return input instanceof AbortSignal ? { signal: input } : input;
}

/**
 * Fetch, cache and smart-rank the public $0 OpenRouter catalog. Network failures
 * degrade to the curated free picks instead of leaving an empty dropdown.
 */
export async function discoverOpenRouterFreeModels(
  input?: AbortSignal | FetchOpenRouterModelsOptions,
): Promise<OpenRouterDiscoveryResult> {
  const { signal, force } = normalizeOptions(input);
  if (!force && cachedModels && Date.now() - cachedAt < CACHE_TTL_MS) {
    return { models: cachedModels, source: 'cache' };
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) throw new Error(`OpenRouter models request failed (${response.status})`);

    const payload = (await response.json()) as OpenRouterModelsResponse;
    const data = Array.isArray(payload.data) ? payload.data : [];
    const freeModels = data
      .map(toDiscoveredModel)
      .filter((model): model is DiscoveredModel => Boolean(model))
      .filter(
        (model) =>
          isZeroPrice(model.promptPrice) &&
          isZeroPrice(model.completionPrice) &&
          !isHighCongestionModel(model.id),
      )
      .map(({ id, name, contextLength }) => ({ id, name, contextLength }));

    // Curated slugs are always present (offline safety net); live metadata wins.
    const merged = uniqueModels([...freeModels, ...getCuratedFreeModels()]);
    const ranked = rankFreeModels(merged).map(withLabel);
    cachedModels = ranked;
    cachedAt = Date.now();
    return { models: ranked, source: 'live' };
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    return { models: getCuratedFreeModels(), source: 'fallback' };
  }
}


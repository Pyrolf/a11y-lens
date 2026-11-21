import { buildDiff } from '../buildDiff';
import { sanitizeLlmHtml } from '../sanitizeLlmHtml';
import { postProcessLlmHtml } from '../postProcessLlmHtml';
import { A11Y_FIX_SYSTEM_PROMPT, DEFAULT_OPENROUTER_MODEL } from '../../../lib/constants';
import type { AiFixRequest, AiFixResult } from '../../../types/ai';

type ContentPart = { type?: string; text?: string };
type UnhealthyStatus = 429 | 404;
type ModelFailureCallback = (model: string, status: UnhealthyStatus) => void;

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string | ContentPart[] } }>;
}

/** Marks 429 banners that should offer the one-click, zero-key demo fallback. */
export class OpenRouterRateLimitError extends Error {
  readonly suggestDemoFix = true;

  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterRateLimitError';
  }
}

function responseText(content: string | ContentPart[] | undefined): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text ?? '')).join('');
  }
  return '';
}

function openRouterError(
  status: number,
  body: string,
  usedFallback: boolean,
  requestedModel: string,
): Error {
  const detail = body.replace(/\s+/g, ' ').trim().slice(0, 160);
  switch (status) {
    case 401:
    case 403:
      return new Error(`OpenRouter rejected the API key (${status}). Check the key in Provider Settings — it should start with "sk-or-". You can also use Demo AI Fix (No Key Required).`);
    case 402:
      return new Error("OpenRouter account has no remaining credits (402). Use a free model such as openrouter/free (OpenRouter's $0 auto-router), or try Demo AI Fix (No Key Required).");
    case 404:
      return new Error(
        `OpenRouter model not found (404) for ${requestedModel}${usedFallback ? ` and the ${DEFAULT_OPENROUTER_MODEL} fallback` : ''}. Verify the model ID in Provider Settings (try openrouter/free or another free quick pick).${detail ? ` ${detail}` : ''}`,
      );
    case 429:
      return new OpenRouterRateLimitError(
        usedFallback
          ? `OpenRouter rate limit reached (429) on ${requestedModel} and ${DEFAULT_OPENROUTER_MODEL} — even the free auto-router fallback was limited. Try Demo AI Fix (No Key Required) below; it runs locally with no API key.`
          : `OpenRouter rate limit reached (429) on ${requestedModel}. The ${DEFAULT_OPENROUTER_MODEL} auto-router is also at capacity. Try Demo AI Fix (No Key Required) below; it runs locally with no API key.`,
      );
    default:
      if (status >= 500) {
        return new Error(`OpenRouter is temporarily unavailable (${status}). Try again shortly or use Demo AI Fix (No Key Required).${detail ? ` ${detail}` : ''}`);
      }
      return new Error(`OpenRouter request failed (${status}). ${detail || 'Check your provider settings and try again.'}`);
  }
}

interface CompletionParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  signal?: AbortSignal;
}

async function postChatCompletion({
  baseUrl,
  apiKey,
  model,
  prompt,
  signal,
}: CompletionParams): Promise<Response> {
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'A11y-Lens',
    },
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: A11Y_FIX_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });
}

function isRetryableModelFailure(status: number): status is UnhealthyStatus {
  return status === 429 || status === 404;
}

export async function createOpenRouterFix(
  request: AiFixRequest,
  onModelFailure?: ModelFailureCallback,
  signal?: AbortSignal,
): Promise<AiFixResult> {
  if (request.provider.id !== 'openrouter') throw new Error('Invalid provider for OpenRouter fix.');
  const apiKey = request.provider.apiKey.trim();
  if (!apiKey) throw new Error('OpenRouter API key is required. Add it in provider settings or use Demo mode.');

  const issuesText = request.issues.map((i, idx) => `${idx + 1}. [${i.ruleId}] ${i.message} (${i.node.selector})`).join('\n');
  const prompt = [
    'You are an accessibility engineer. Refactor the provided HTML/Tailwind snippet to fix WCAG AA issues.',
    'Preserve visual intent and structure as much as possible.',
    'Return ONLY the complete patched HTML snippet. No markdown fences, no explanation.',
    request.instruction ? `User instruction: ${request.instruction}` : '',
    'Issues to fix:',
    issuesText || '(none provided)',
    'HTML:',
    request.snippet.html,
  ].filter(Boolean).join('\n\n');

  const requestedModel = request.provider.model.trim() || DEFAULT_OPENROUTER_MODEL;
  // A rotated individual :free slug can be rate-limited or de-listed; retry once
  // on the $0 auto-router. The auto-router itself is never retried against itself,
  // and paid custom models are left alone so we never silently change billing.
  const canFallback = requestedModel !== DEFAULT_OPENROUTER_MODEL && requestedModel.includes(':free');
  let activeModel = requestedModel;
  let usedFallback = false;
  let fallbackStatus: UnhealthyStatus | null = null;
  const markFailure = (model: string, status: number) => {
    if (isRetryableModelFailure(status)) onModelFailure?.(model, status);
  };

  let res: Response;
  try {
    res = await postChatCompletion({
      baseUrl: request.provider.baseUrl,
      apiKey,
      model: requestedModel,
      prompt,
      signal,
    });
    if (isRetryableModelFailure(res.status) && canFallback) {
      fallbackStatus = res.status;
      markFailure(requestedModel, res.status);
      activeModel = DEFAULT_OPENROUTER_MODEL;
      usedFallback = true;
      res = await postChatCompletion({
        baseUrl: request.provider.baseUrl,
        apiKey,
        model: DEFAULT_OPENROUTER_MODEL,
        prompt,
        signal,
      });
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    throw new Error('Could not reach OpenRouter. Check your internet connection, or use Demo AI Fix (No Key Required).');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    markFailure(activeModel, res.status);
    throw openRouterError(res.status, text || res.statusText, usedFallback, requestedModel);
  }

  let data: OpenRouterResponse;
  try {
    data = await res.json() as OpenRouterResponse;
  } catch {
    throw new Error('OpenRouter returned an unreadable response. Try again, or use Demo AI Fix (No Key Required).');
  }
  const content = responseText(data.choices?.[0]?.message?.content);
  if (!content.trim()) throw new Error('OpenRouter returned no content. Try again, or use Demo AI Fix (No Key Required).');
  let patchedHtml = sanitizeLlmHtml(content);
  if (!patchedHtml) throw new Error('OpenRouter returned no usable HTML. Try again, or use Demo AI Fix (No Key Required).');
  patchedHtml = postProcessLlmHtml(patchedHtml);

  return {
    providerId: 'openrouter',
    generatedAt: new Date().toISOString(),
    summary: usedFallback
      ? fallbackStatus === 429
        ? `OpenRouter (${activeModel}) suggested an accessibility refactor after ${requestedModel} was rate limited (429); the free auto-router was used automatically.`
        : `OpenRouter (${activeModel}) suggested an accessibility refactor after ${requestedModel} failed (${fallbackStatus ?? 'unavailable'}); the free auto-router was used automatically.`
      : `OpenRouter (${activeModel}) suggested an accessibility refactor.`,
    patchedHtml,
    diff: buildDiff(request.snippet.html, patchedHtml),
    warnings: ['Review AI-generated changes before applying. Deterministic audit remains the source of truth.'],
    appliedIssueIds: request.issues.map((i) => i.id),
  };
}

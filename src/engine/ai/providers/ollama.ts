import { buildDiff } from '../buildDiff';
import { sanitizeLlmHtml } from '../sanitizeLlmHtml';
import { postProcessLlmHtml } from '../postProcessLlmHtml';
import { A11Y_FIX_SYSTEM_PROMPT } from '../../../lib/constants';
import type { AiFixRequest, AiFixResult } from '../../../types/ai';

export async function createOllamaFix(
  request: AiFixRequest,
  signal?: AbortSignal,
): Promise<AiFixResult> {
  if (request.provider.id !== 'ollama') throw new Error('Invalid provider for Ollama fix.');

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

  let res: Response;
  try {
    res = await fetch(`${request.provider.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.provider.model,
        system: A11Y_FIX_SYSTEM_PROMPT,
        prompt,
        stream: false,
        options: { temperature: 0.2 },
      }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    throw new Error(
      `Ollama not detected at ${request.provider.baseUrl} — run \`ollama pull ${request.provider.model}\` and start Ollama, or use Try Demo AI Fix.`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const detail = text.replace(/\s+/g, ' ').trim().slice(0, 160);
    if (res.status === 404) {
      throw new Error(
        `Ollama model "${request.provider.model}" was not found. Run \`ollama pull ${request.provider.model}\`, or use Try Demo AI Fix.`,
      );
    }
    throw new Error(
      `Ollama request failed (${res.status}). ${detail || `Check that Ollama is running at ${request.provider.baseUrl}.`}`,
    );
  }

  let data: { response?: string };
  try {
    data = await res.json() as { response?: string };
  } catch {
    throw new Error('Ollama returned an unreadable response. Try again, or use Demo AI Fix (No Key Required).');
  }
  if (!data.response?.trim()) throw new Error('Ollama returned no content. Try again, or use Demo AI Fix (No Key Required).');
  let patchedHtml = sanitizeLlmHtml(data.response);
  if (!patchedHtml) throw new Error('Ollama returned no usable HTML. Try again, or use Demo AI Fix (No Key Required).');
  patchedHtml = postProcessLlmHtml(patchedHtml);

  return {
    providerId: 'ollama',
    generatedAt: new Date().toISOString(),
    summary: `Ollama (${request.provider.model}) suggested an accessibility refactor.`,
    patchedHtml,
    diff: buildDiff(request.snippet.html, patchedHtml),
    warnings: ['Review AI-generated changes before applying. Deterministic audit remains the source of truth.'],
    appliedIssueIds: request.issues.map((i) => i.id),
  };
}

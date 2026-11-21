import type { AuditRule } from '../types/audit';
import type { AiProviderId } from '../types/ai';

export const APP_NAME = 'A11y-Lens';

/** OpenRouter's official $0 auto-router: it keeps working as individual free slugs rotate. */
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

/** Fallback quick picks when live model discovery is unavailable. */
export const OPENROUTER_FREE_MODELS = [
  'openrouter/free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'liquid/lfm-3-1.7b:free',
] as const;

/**
 * Upstream families that chronically return 429s on their :free endpoints.
 * They are hidden from the default dropdown, but any slug can still be typed
 * via "Custom model ID...".
 */
export const HIGH_CONGESTION_OPENROUTER_FAMILIES = ['google/', 'inclusionai/'] as const;

/**
 * Smart-ranking hints for free models. Earlier terms win ties, so a coding model
 * with a smaller context still outranks a general model with a larger one.
 */
export const OPENROUTER_CODING_AFFINITY_TERMS = [
  'code',
  'coder',
  'nemotron',
  'flint',
  'north',
  'qwen',
  'deepseek',
] as const;

/** Public OpenRouter model catalog used for live free-model discovery. */
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models' as const;
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5-coder:7b';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1' as const;
export const OLLAMA_BASE_URL = 'http://localhost:11434' as const;

/** Curated local coding models shown when Ollama model discovery is unavailable. */
export const OLLAMA_FALLBACK_MODELS = [
  'qwen2.5-coder:7b',
  'qwen3:8b',
  'gemma3:4b',
  'llama3.2:3b',
] as const;

export const SESSION_STORAGE_KEYS = {
  aiProviderId: 'a11y-lens.ai.provider',
  openRouterApiKey: 'a11y-lens.ai.openrouter.key',
  openRouterModel: 'a11y-lens.ai.openrouter.model',
  ollamaModel: 'a11y-lens.ai.ollama.model',
  ollamaBaseUrl: 'a11y-lens.ai.ollama.baseUrl',
} as const;

export const DEFAULT_AI_PROVIDER_ID: AiProviderId = 'demo';

/** Shared system prompt so BYOK providers target the same deterministic and axe-backed rules. */
export const A11Y_FIX_SYSTEM_PROMPT = [
  'You are an accessibility engineer. Refactor the provided HTML/Tailwind snippet to fix WCAG 2.1 AA issues.',
  'You MUST explicitly fix ALL applicable issues for these 8 rules (and do not introduce new violations):',
  '1) color-contrast: Ensure text/background contrast meets WCAG AA. Normal text contrast must be >= 4.5:1; large text (>=18pt or >=14pt bold, per WCAG) contrast must be >= 3:1. Adjust text or background colors (prefer Tailwind classes or inline styles) to reach required contrast while preserving visual intent.',
  '2) img-alt: Every <img> must have a descriptive alt attribute. Do not leave alt missing. For purely decorative images use alt="" only if truly decorative; otherwise provide meaningful, concise alt text.',
  '3) accessible-name: Every <button> and every <a> must have an accessible name (visible text content, or aria-label, or aria-labelledby). Do not leave buttons/links unnamed.',
  '4) form-label: Every <input>, <select>, and <textarea> must have an associated <label> (label[for] matching id, or a wrapping <label>) OR an aria-label/aria-labelledby. Placeholder text alone is NOT sufficient. Hidden/submit/reset/button/image inputs are exempt.',
  '5) skipped-heading: Heading order must be sequential without skipping levels (e.g. h1 -> h2 -> h3). Do not skip from h1 to h3. Avoid multiple h1 elements; use a single h1 where appropriate.',
  "6) vague-link-text: NEVER output generic/vague link text such as \"Learn more\", \"Read more\", \"Click here\", or \"Here\". Always replace with descriptive destination/context text (e.g. \"Explore accessibility documentation\", \"View A11y-Lens features\", \"Read about pricing plans\"). If the destination is unclear, infer a reasonable descriptive label from nearby headings/context.",
  '7) positive-tabindex: Do NOT use tabindex greater than 0 (no tabindex="1", tabindex="2", etc.). Use tabindex="0" only if necessary, or remove positive tabindex so natural focus order is preserved.',
  '8) outline-suppression: Never use outline-none or remove outlines without providing a visible focus indicator. If you suppress an outline, you MUST add a visible focus-visible style such as focus-visible:ring-* or focus-visible:outline-* (Tailwind) or an equivalent :focus-visible rule. Do not leave keyboard focus invisible.',
  'Preserve visual intent and structure as much as possible. Make minimal, safe edits.',
  'Return ONLY the complete patched HTML snippet. No markdown fences, no explanation.',
].join('\n');

export const AUDIT_RULES: AuditRule[] = [
  {
    id: 'color-contrast',
    name: 'Color Contrast',
    description: 'Text contrast should meet WCAG AA (>= 4.5:1 normal, >= 3:1 large text).',
    wcag: { criterion: '1.4.3 Contrast (Minimum)', level: 'AA' },
    severity: 'error',
  },
  {
    id: 'image-alt',
    name: 'Image Alt Text',
    description: 'Meaningful images must have appropriate alternative text.',
    wcag: { criterion: '1.1.1 Non-text Content', level: 'A' },
    severity: 'error',
  },
  {
    id: 'accessible-name',
    name: 'Accessible Name',
    description: 'Buttons and links must expose an accessible name.',
    wcag: { criterion: '4.1.2 Name, Role, Value', level: 'A' },
    severity: 'error',
  },
  {
    id: 'form-label',
    name: 'Form Control Label',
    description: 'Inputs, selects and textareas need a <label> or aria-label.',
    wcag: { criterion: '3.3.2 Labels or Instructions', level: 'A' },
    severity: 'error',
  },
  {
    id: 'heading-order',
    name: 'Heading Order',
    description: 'Headings should not skip levels or repeat <h1>.',
    wcag: { criterion: '1.3.1 Info and Relationships', level: 'A' },
    severity: 'warning',
  },
  {
    id: 'vague-link-text',
    name: 'Vague Link Text',
    description: 'Link text should describe its destination, not say "click here".',
    wcag: { criterion: '2.4.4 Link Purpose (In Context)', level: 'A' },
    severity: 'warning',
  },
  {
    id: 'positive-tabindex',
    name: 'Positive Tabindex',
    description: 'Avoid tabindex values greater than zero; they disrupt focus order.',
    wcag: { criterion: '2.4.3 Focus Order', level: 'A' },
    severity: 'warning',
  },
  {
    id: 'focus-outline',
    name: 'Focus Outline',
    description: 'Suppressing the focus outline requires a :focus-visible replacement.',
    wcag: { criterion: '2.4.7 Focus Visible', level: 'AA' },
    severity: 'warning',
  },
];

import type { AuditIssue } from './audit';
import type { CodeSnippet } from './editor';

export type AiProviderId = 'demo' | 'openrouter' | 'ollama';
export type AiRunStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DemoProviderConfig {
  id: 'demo';
  label: 'Demo AI Fix';
  requiresKey: false;
}

export interface OpenRouterProviderConfig {
  id: 'openrouter';
  label: 'OpenRouter';
  requiresKey: true;
  apiKey: string;
  model: string;
  baseUrl: 'https://openrouter.ai/api/v1';
}

export interface OllamaProviderConfig {
  id: 'ollama';
  label: 'Ollama';
  requiresKey: false;
  model: string;
  baseUrl: string;
}

export type AiProviderConfig =
  | DemoProviderConfig
  | OpenRouterProviderConfig
  | OllamaProviderConfig;

export interface AiFixRequest {
  snippet: CodeSnippet;
  issues: AuditIssue[];
  instruction?: string;
  provider: AiProviderConfig;
}

export type DiffLineType = 'context' | 'add' | 'remove';

export interface TextDiffLine {
  type: DiffLineType;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface AiFixResult {
  providerId: AiProviderId;
  generatedAt: string;
  summary: string;
  patchedHtml: string;
  diff: TextDiffLine[];
  warnings: string[];
  appliedIssueIds: string[];
}

export interface AiState {
  providerId: AiProviderId;
  status: AiRunStatus;
  error?: string;
  /** Set when an OpenRouter 429 should surface a one-click, zero-key demo fallback. */
  errorSuggestsDemoFix?: boolean;
  result?: AiFixResult;
}

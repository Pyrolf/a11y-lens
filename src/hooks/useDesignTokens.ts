import { useCallback, useState } from 'react';
import { extractTokens } from '../engine/tokens/extractTokens';
import type { ComputedStyleEntry } from '../types/audit';
import type { CodeSnippet } from '../types/editor';
import type { TokenExtractionResult } from '../types/tokens';

export function useDesignTokens() {
  const [result, setResult] = useState<TokenExtractionResult | null>(null);

  const run = useCallback((snippet: CodeSnippet, computedStyles: ComputedStyleEntry[] = []) => {
    setResult(extractTokens(snippet, computedStyles));
  }, []);

  return { result, run };
}

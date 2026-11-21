import { useCallback, useState } from 'react';
import { runAudit } from '../engine/audit/runAudit';
import type {
  AuditResult,
  AxeRuleReport,
  AxeViolationReport,
  ComputedStyleEntry,
} from '../types/audit';
import type { CodeSnippet } from '../types/editor';

export function useAudit() {
  const [result, setResult] = useState<AuditResult | null>(null);

  const run = useCallback(
    (
      snippet: CodeSnippet,
      computedStyles: ComputedStyleEntry[] = [],
      axeViolations: AxeViolationReport[] = [],
      axePasses: AxeRuleReport[] = [],
    ) => {
      setResult(runAudit(snippet, computedStyles, axeViolations, axePasses));
    },
    [],
  );

  return { result, run };
}

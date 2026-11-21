import type {
  AxeRuleReport,
  AxeViolationReport,
  ComputedStyleEntry,
} from '../../types/audit';
import type { CodeSnippet } from '../../types/editor';
import { auditHtml } from '../../utils/wcagAuditor';

export function runAudit(
  snippet: CodeSnippet,
  computedStyles: ComputedStyleEntry[] = [],
  axeViolations: AxeViolationReport[] = [],
  axePasses: AxeRuleReport[] = [],
) {
  return auditHtml(snippet.html, snippet.id, { computedStyles, axeViolations, axePasses });
}

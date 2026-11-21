export type WcagLevel = 'A' | 'AA' | 'AAA';
export type AuditSeverity = 'error' | 'warning' | 'info';
export type AuditRuleId = string;

export type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical' | null;

export interface AuditRule {
  id: AuditRuleId;
  name: string;
  description: string;
  wcag: { criterion: string; level: WcagLevel | 'Unknown' };
  severity: AuditSeverity;
}

export interface AuditNodeRef {
  selector: string;
  snippet: string;
  lineHint?: number;
}

export interface AuditIssueDetails {
  contrastRatio?: number;
  requiredRatio?: number;
  foreground?: string;
  background?: string;
  expected?: string;
  actual?: string;
}

export interface AuditIssue {
  id: string;
  ruleId: AuditRuleId;
  severity: AuditSeverity;
  message: string;
  help: string;
  node: AuditNodeRef;
  details?: AuditIssueDetails;
  /** Axe-core rule ID when this issue originated from the sandbox axe run. */
  axeRuleId?: string;
  /** axe-core impact when available. */
  impact?: AxeImpact;
  /** Best-effort WCAG tags reported by axe-core. */
  wcagTags?: string[];
}

/** Compact rule descriptor shared by the audit summary badges. */
export interface AuditedRule {
  id: AuditRuleId;
  description: string;
}

export interface AuditSummary {
  errors: number;
  warnings: number;
  infos: number;
  /** Rules that finished this run without a failure, after cross-engine dedupe. */
  passedRules: AuditedRule[];
  /** Total rule IDs evaluated in this run (custom + axe, deduplicated). */
  totalRules: number;
}

export interface AuditResult {
  snippetId: string;
  ranAt: string;
  durationMs: number;
  issues: AuditIssue[];
  summary: AuditSummary;
}

/**
 * Serialized `getComputedStyle` values collected inside the sandbox iframe.
 * The iframe has an opaque origin, so it posts this snapshot to the parent
 * instead of exposing its document directly.
 */
export interface ComputedStyleEntry {
  tag: string;
  id?: string;
  className: string;
  text: string;
  selector: string;
  outerHTML: string;
  styles: Record<string, string>;
  /** Nearest non-transparent background color, including ancestors. */
  effectiveBackground: string;
}

/** Serializable rule metadata sent from the sandbox iframe (passes or violations). */
export interface AxeRuleReport {
  ruleId: string;
  description: string;
  help: string;
  helpUrl?: string;
  wcagTags: string[];
  wcagCriterion: string;
  wcagLevel: WcagLevel | 'Unknown';
}

/** Serializable axe-core violation payload sent from the sandbox iframe. */
export interface AxeViolationReport extends AxeRuleReport {
  impact: AxeImpact;
  nodes: AuditNodeRef[];
}

/** One atomic axe result message: both outcomes arrive from the same iframe run. */
export interface AxeResultsPayload {
  violations: AxeViolationReport[];
  passes: AxeRuleReport[];
}

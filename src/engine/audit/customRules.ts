export interface CustomAuditRule {
  /** Stable rule ID used in findings and reports. */
  id: string;
  /** CSS selector for the elements this rule inspects. */
  selector: string;
  /** Human-readable failure message. */
  message: string;
  /**
   * Returns true when the element passes. Keep this pure and side-effect free:
   * it runs once per matched element during `auditHtml`.
   */
  test: (element: Element, document: Document) => boolean;
}

const registeredRules = new Set<CustomAuditRule>();

/** Registers a reusable custom rule for every subsequent audit. */
export function registerAuditRule(rule: CustomAuditRule): () => void {
  registeredRules.add(rule);
  return () => {
    registeredRules.delete(rule);
  };
}

export function unregisterAuditRule(rule: CustomAuditRule): void {
  registeredRules.delete(rule);
}

export function getRegisteredAuditRules(): CustomAuditRule[] {
  return [...registeredRules];
}

export function clearRegisteredAuditRules(): void {
  registeredRules.clear();
}

/** Combines explicitly passed rules with the global registry. */
export function resolveAuditRules(passed?: CustomAuditRule[]): CustomAuditRule[] {
  if (!passed || passed.length === 0) return getRegisteredAuditRules();
  return [...getRegisteredAuditRules(), ...passed];
}
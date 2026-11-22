import { AUDIT_RULES } from '../lib/constants';
import type {
  AuditIssue,
  AuditedRule,
  AuditIssueDetails,
  AuditNodeRef,
  AuditResult,
  AuditRule,
  AuditRuleId,
  AuditSeverity,
  AxeImpact,
  AxeRuleReport,
  AxeViolationReport,
  ComputedStyleEntry,
  WcagLevel,
} from '../types/audit';
import {
  AA_LARGE_TEXT_RATIO,
  AA_NORMAL_TEXT_RATIO,
  contrastRatio,
} from './colorMath';
import {
  collectCssVariables,
  effectiveBackgroundColor,
  fontSizeForElement,
  fontWeightForElement,
  isLargeText,
  parseFontSizePx,
  parseInlineDeclarations,
  textColorForElement,
} from './styleResolver';
import { resolveAuditRules, type CustomAuditRule } from '../engine/audit/customRules';

export { contrastRatio, parseColor } from './colorMath';

/**
 * Deterministic, 100% client-side WCAG 2.1 AA checks.
 *
 * Structural rules run against a DOMParser document so they work before the
 * iframe mounts. Color contrast prefers the real `getComputedStyle` snapshot
 * posted by the sandbox iframe (Tailwind utilities, CSS variables and inherited
 * backgrounds already resolved) and falls back to a source-level resolver.
 */

const IMPLICIT_DOCUMENT_TAGS = new Set(['html', 'head', 'body']);
const VAGUE_LINK_TEXT = new Set(['click here', 'read more', 'learn more', 'here']);
const NON_LABELABLE_INPUT_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image']);

interface AuditOptions {
  computedStyles?: ComputedStyleEntry[];
  axeViolations?: AxeViolationReport[];
  axePasses?: AxeRuleReport[];
  customRules?: CustomAuditRule[];
}

/** Text directly owned by an element (not by its descendants). */
function directText(element: Element): string {
  let text = '';
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? '';
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Text alternative of a subtree, mirroring the browser's accessible-name walk. */
function textAlternative(node: Node, doc: Document, seen: Set<Element>): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as Element;
  if (seen.has(element)) return '';
  seen.add(element);
  if (element.getAttribute('aria-hidden') === 'true') return '';

  const tag = element.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'template') return '';

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => {
        const target = doc.getElementById(id);
        return target ? textAlternative(target, doc, seen) : '';
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ').trim();
  }

  if (tag === 'img') {
    const alt = element.getAttribute('alt');
    if (alt && alt.trim()) return alt.trim();
  }

  let result = '';
  for (const child of Array.from(element.childNodes)) {
    result += textAlternative(child, doc, seen);
  }
  return result.trim();
}

function computeAccessibleName(element: Element, doc: Document): string {
  const name = textAlternative(element, doc, new Set<Element>());
  if (name) return name;
  return (element.getAttribute('title') ?? '').trim();
}

function hasLabelAssociation(input: Element, doc: Document): boolean {
  if ((input.getAttribute('aria-label') ?? '').trim()) return true;

  const id = input.getAttribute('id');
  if (id) {
    const labels = Array.from(doc.querySelectorAll('label'));
    if (labels.some((label) => label.getAttribute('for') === id)) return true;
  }

  if (input.closest('label')) return true;

  const labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy.split(/\s+/).some((token) => {
      const target = doc.getElementById(token);
      return Boolean(target && textAlternative(target, doc, new Set<Element>()));
    });
  }

  return false;
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

function buildSelector(element: Element): string {
  const tag = element.tagName.toLowerCase();
  let selector = tag;
  if (element.id) {
    selector += `#${cssEscape(element.id)}`;
  } else {
    const classes = Array.from(element.classList).slice(0, 2).map(cssEscape);
    if (classes.length > 0) selector += `.${classes.join('.')}`;
  }

  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (sibling) => sibling.tagName === element.tagName,
    );
    if (siblings.length > 1) {
      selector += `:nth-of-type(${siblings.indexOf(element) + 1})`;
    }
  }
  return selector;
}

function truncate(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

interface OpeningTag {
  tag: string;
  line: number;
}

function scanOpeningTags(source: string): OpeningTag[] {
  const tags: OpeningTag[] = [];
  const pattern = /<([a-zA-Z][\w:-]*)\b[^>]*>/g;
  let match: RegExpExecArray | null = pattern.exec(source);
  while (match !== null) {
    const tag = match[1].toLowerCase();
    if (!IMPLICIT_DOCUMENT_TAGS.has(tag)) {
      const line = source.slice(0, match.index).split('\n').length;
      tags.push({ tag, line });
    }
    match = pattern.exec(source);
  }
  return tags;
}

function buildLineHints(doc: Document, source: string): Map<Element, number> {
  const tags = scanOpeningTags(source);
  const elements = Array.from(doc.body.querySelectorAll('*'));
  const hints = new Map<Element, number>();
  let cursor = 0;

  for (const element of elements) {
    const wanted = element.tagName.toLowerCase();
    while (cursor < tags.length && tags[cursor].tag !== wanted) cursor += 1;
    if (cursor < tags.length) {
      hints.set(element, tags[cursor].line);
      cursor += 1;
    }
  }
  return hints;
}

const AXE_RULE_MAP: Record<string, AuditRuleId> = {
  'image-alt': 'image-alt',
  'button-name': 'accessible-name',
  'link-name': 'accessible-name',
  label: 'form-label',
  'select-name': 'form-label',
  'color-contrast': 'color-contrast',
  'heading-order': 'heading-order',
  tabindex: 'positive-tabindex',
  'frame-title': 'frame-title',
  'meta-viewport': 'meta-viewport',
  list: 'list',
  listitem: 'listitem',
  'duplicate-id': 'duplicate-id',
  'aria-valid-attr': 'aria-valid-attr',
  'aria-required-attr': 'aria-required-attr',
};

/** Collapse axe rule IDs that describe the same check as a custom rule. */
function canonicalRuleId(axeRuleId: string): AuditRuleId {
  return AXE_RULE_MAP[axeRuleId] ?? axeRuleId;
}

const AXE_RULE_FALLBACKS: Record<string, Omit<AuditRule, 'id'>> = {
  'frame-title': {
    name: 'Frame Title',
    description: 'Frames must have an accessible title.',
    wcag: { criterion: '4.1.2 Name, Role, Value', level: 'A' },
    severity: 'error',
  },
  'meta-viewport': {
    name: 'Meta Viewport',
    description: 'Viewport settings must not disable text scaling and zooming.',
    wcag: { criterion: '1.4.4 Resize Text', level: 'AA' },
    severity: 'error',
  },
  list: {
    name: 'List Structure',
    description: 'Lists must only contain valid list children.',
    wcag: { criterion: '1.3.1 Info and Relationships', level: 'A' },
    severity: 'error',
  },
  listitem: {
    name: 'List Item Structure',
    description: 'List items must be contained in a valid list.',
    wcag: { criterion: '1.3.1 Info and Relationships', level: 'A' },
    severity: 'error',
  },
  'duplicate-id': {
    name: 'Duplicate ID',
    description: 'ID attributes must be unique.',
    wcag: { criterion: '4.1.1 Parsing', level: 'A' },
    severity: 'error',
  },
  'aria-valid-attr': {
    name: 'Valid ARIA Attribute',
    description: 'ARIA attributes must be valid.',
    wcag: { criterion: '4.1.2 Name, Role, Value', level: 'A' },
    severity: 'error',
  },
  'aria-required-attr': {
    name: 'Required ARIA Attribute',
    description: 'Required ARIA attributes must be present.',
    wcag: { criterion: '4.1.2 Name, Role, Value', level: 'A' },
    severity: 'error',
  },
};

function impactToSeverity(impact: AxeImpact, fallback: AuditSeverity = 'warning'): AuditSeverity {
  if (impact === 'critical' || impact === 'serious') return 'error';
  if (impact === 'moderate') return 'warning';
  if (impact === 'minor') return 'info';
  return fallback;
}

function ruleFor(ruleId: AuditRuleId, axe?: AxeViolationReport): AuditRule {
  const core = AUDIT_RULES.find((candidate) => candidate.id === ruleId);
  if (core) return core;
  const fallback = AXE_RULE_FALLBACKS[ruleId];
  if (fallback) return { id: ruleId, ...fallback };
  return {
    id: ruleId,
    name: axe?.ruleId ?? ruleId,
    description: axe?.description || 'Accessibility issue detected by axe-core.',
    wcag: {
      criterion: axe?.wcagCriterion || 'Best practice',
      level: (axe?.wcagLevel ?? 'Unknown') as WcagLevel | 'Unknown',
    },
    severity: impactToSeverity(axe?.impact ?? null, 'warning'),
  };
}

function createIssue(
  ruleId: AuditRuleId,
  node: AuditNodeRef,
  message: string,
  details: AuditIssueDetails | undefined,
  occurrence: number,
  meta?: { axe?: AxeViolationReport; severity?: AuditSeverity; help?: string },
): AuditIssue {
  const rule = ruleFor(ruleId, meta?.axe);
  const severity = meta?.severity ?? rule.severity;
  const wcagLabel = rule.wcag.criterion === 'Best practice'
    ? 'axe-core best practice'
    : `WCAG ${rule.wcag.criterion}, Level ${rule.wcag.level}`;
  return {
    id: `${ruleId}:${node.selector}:${occurrence}`,
    ruleId,
    severity,
    message,
    help: meta?.help ?? `${rule.description} (${wcagLabel})`,
    node,
    details,
    axeRuleId: meta?.axe?.ruleId,
    impact: meta?.axe?.impact,
    wcagTags: meta?.axe?.wcagTags,
  };
}

/** Runs deterministic checks and merges axe-core violations into one AuditResult. */
export function auditHtml(html: string, snippetId: string, options: AuditOptions = {}): AuditResult {
  const startedAt = new Date();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const lineHints = buildLineHints(doc, html);
  const issues: AuditIssue[] = [];
  const occurrences = new Map<AuditRuleId, number>();
  const seenFindings = new Set<string>();

  const push = (
    ruleId: AuditRuleId,
    node: AuditNodeRef,
    message: string,
    details?: AuditIssueDetails,
    meta?: { axe?: AxeViolationReport; severity?: AuditSeverity; help?: string },
  ) => {
    const key = `${ruleId}::${node.selector}`;
    if (seenFindings.has(key)) return;
    seenFindings.add(key);
    const occurrence = (occurrences.get(ruleId) ?? 0) + 1;
    occurrences.set(ruleId, occurrence);
    issues.push(createIssue(ruleId, node, message, details, occurrence, meta));
  };

  const pushElement = (
    ruleId: AuditRuleId,
    element: Element,
    message: string,
    details?: AuditIssueDetails,
    meta?: { axe?: AxeViolationReport; severity?: AuditSeverity; help?: string },
  ) => {
    push(
      ruleId,
      {
        selector: buildSelector(element),
        snippet: truncate(element.outerHTML, 180),
        lineHint: lineHints.get(element),
      },
      message,
      details,
      meta,
    );
  };

  // 1. Images must expose alternative text (or be explicitly decorative).
  for (const image of Array.from(doc.querySelectorAll('img'))) {
    const role = image.getAttribute('role');
    if (image.hasAttribute('alt') || role === 'presentation' || role === 'none') continue;
    pushElement(
      'image-alt',
      image,
      'Image is missing an alt attribute.',
      { expected: 'alt="description" or role="presentation"' },
    );
  }

  // 2. Buttons and links must have an accessible name.
  for (const control of Array.from(doc.querySelectorAll('button, a'))) {
    if (computeAccessibleName(control, doc)) continue;
    pushElement(
      'accessible-name',
      control,
      `${control.tagName.toLowerCase()} has no accessible text or aria-label.`,
      { expected: 'visible text, aria-label, or aria-labelledby' },
    );
  }

  // 3. Form controls need a programmatic label. Placeholder alone is not enough.
  for (const control of Array.from(doc.querySelectorAll('input, select, textarea'))) {
    const tag = control.tagName.toLowerCase();
    const type = (control.getAttribute('type') ?? 'text').toLowerCase();
    if (tag === 'input' && NON_LABELABLE_INPUT_TYPES.has(type)) continue;
    if (hasLabelAssociation(control, doc)) continue;
    pushElement(
      'form-label',
      control,
      `${tag} has no associated <label> or aria-label.`,
      { expected: 'label[for], wrapping <label>, or aria-label' },
    );
  }

  // 4. Heading levels must not skip more than one level at a time or repeat h1.
  let previousHeadingLevel = 0;
  let h1Count = 0;
  for (const heading of Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
    const level = Number(heading.tagName.charAt(1));
    if (level === 1) h1Count += 1;
    if (previousHeadingLevel > 0 && level > previousHeadingLevel + 1) {
      pushElement(
        'heading-order',
        heading,
        `Heading level jumps from h${previousHeadingLevel} to h${level}.`,
        { expected: `h${previousHeadingLevel + 1}`, actual: `h${level}` },
      );
    } else if (h1Count > 1 && level === 1) {
      pushElement(
        'heading-order',
        heading,
        'Page has more than one h1 heading.',
        { expected: 'a single h1', actual: `${h1Count} h1 elements` },
      );
    }
    previousHeadingLevel = level;
  }

  // 5. Link text should describe the destination.
  for (const link of Array.from(doc.querySelectorAll('a'))) {
    const name = computeAccessibleName(link, doc).toLowerCase().replace(/[.!?]+$/, '').trim();
    if (!VAGUE_LINK_TEXT.has(name)) continue;
    pushElement(
      'vague-link-text',
      link,
      `Link text "${computeAccessibleName(link, doc).trim()}" does not describe its destination.`,
      { expected: 'descriptive link text', actual: name },
    );
  }

  // 6. Positive tabindex overrides the natural keyboard focus order.
  for (const element of Array.from(doc.querySelectorAll('[tabindex]'))) {
    const value = Number(element.getAttribute('tabindex'));
    if (!Number.isInteger(value) || value <= 0) continue;
    pushElement(
      'positive-tabindex',
      element,
      `tabindex="${value}" disrupts the natural focus order.`,
      { expected: 'tabindex="0" or no tabindex', actual: `tabindex="${value}"` },
    );
  }

  // 7. Suppressing the focus outline requires a visible :focus-visible fallback.
  const sourceHasFocusRule = /:(focus-visible|focus-within|focus)\b/.test(html);
  for (const element of Array.from(doc.body.querySelectorAll('*'))) {
    const declarations = parseInlineDeclarations(element.getAttribute('style'));
    const outline = (declarations.get('outline') ?? declarations.get('outline-style') ?? '').trim();
    const inlineSuppressed = /^none$/i.test(outline) || /^0(?:\s+none)?$/i.test(outline);
    const classes = Array.from(element.classList);
    const classSuppressed = classes.some((className) =>
      /^(?:[a-z-]+:)?outline-(?:none|0)$/i.test(className),
    );
    if (!inlineSuppressed && !classSuppressed) continue;

    const hasReplacement =
      sourceHasFocusRule ||
      classes.some((className) =>
        /^(?:focus-visible|focus|focus-within):(?:outline|ring)/i.test(className),
      );
    if (hasReplacement) continue;

    pushElement(
      'focus-outline',
      element,
      'Focus outline is suppressed without a :focus-visible replacement.',
      { expected: 'focus-visible:outline-2 or an equivalent focus ring' },
    );
  }

  // 8. Text/background pairs must meet WCAG AA using real computed colors.
  const computed = options.computedStyles ?? [];
  const variables = collectCssVariables(doc);

  const pushContrast = (
    node: AuditNodeRef,
    foreground: string,
    background: string,
    fontSize: number | null,
    fontWeight: number | null,
  ) => {
    const ratio = contrastRatio(foreground, background);
    if (ratio === null) return;
    const required = isLargeText(fontSize, fontWeight)
      ? AA_LARGE_TEXT_RATIO
      : AA_NORMAL_TEXT_RATIO;
    if (ratio >= required) return;
    push(
      'color-contrast',
      node,
      `Text contrast is ${ratio.toFixed(2)}:1; WCAG AA requires ${required.toFixed(1)}:1.`,
      {
        contrastRatio: Number(ratio.toFixed(2)),
        requiredRatio: required,
        foreground: foreground.trim(),
        background: background.trim(),
      },
    );
  };

  if (computed.length > 0) {
    for (const entry of computed) {
      if (!entry.text.trim()) continue;
      const foreground = entry.styles?.color ?? '';
      const background = entry.effectiveBackground;
      if (!foreground || !background) continue;
      const fontSize = parseFontSizePx(entry.styles?.['font-size']);
      const rawWeight = Number(entry.styles?.['font-weight']);
      const fontWeight = Number.isFinite(rawWeight) ? rawWeight : null;
      pushContrast(
        {
          selector: entry.selector,
          snippet: truncate(entry.outerHTML, 180),
        },
        foreground,
        background,
        fontSize,
        fontWeight,
      );
    }
  } else {
    for (const element of Array.from(doc.body.querySelectorAll('*'))) {
      if (!directText(element)) continue;
      const foreground = textColorForElement(element, variables);
      const background = effectiveBackgroundColor(element, variables);
      if (!foreground || !background) continue;
      pushContrast(
        {
          selector: buildSelector(element),
          snippet: truncate(element.outerHTML, 180),
          lineHint: lineHints.get(element),
        },
        foreground,
        background,
        fontSizeForElement(element),
        fontWeightForElement(element),
      );
    }
  }

  // Run any explicitly provided or globally registered custom audit rules.
  // These let the deterministic engine be extended without changing its core.
  for (const rule of resolveAuditRules(options.customRules)) {
    for (const element of Array.from(doc.querySelectorAll(rule.selector))) {
      if (rule.test(element, doc)) continue;
      pushElement(rule.id, element, rule.message);
    }
  }

  // Merge axe-core violations, deduplicating by (mapped ruleId, selector/snippet).
  // Only ingest axe rules we explicitly support to preserve deterministic counts
  // and avoid noisy best-practice/page-level findings on small snippets.
  const seenSnippets = new Set(issues.map((issue) => `${issue.ruleId}::${issue.node.snippet}`));
  for (const violation of options.axeViolations ?? []) {
    if (!Object.prototype.hasOwnProperty.call(AXE_RULE_MAP, violation.ruleId)) continue;
    const mappedRuleId = AXE_RULE_MAP[violation.ruleId];

    for (const node of violation.nodes ?? []) {
      const snippetKey = `${mappedRuleId}::${node.snippet}`;
      if (seenSnippets.has(snippetKey)) continue;
      const wcagLabel =
        violation.wcagCriterion && violation.wcagLevel !== 'Unknown'
          ? `WCAG ${violation.wcagCriterion}, Level ${violation.wcagLevel}`
          : 'axe-core best practice';
      push(
        mappedRuleId,
        node,
        violation.help || violation.description || `axe-core rule "${violation.ruleId}" failed.`,
        undefined,
        {
          axe: violation,
          severity: impactToSeverity(violation.impact, ruleFor(mappedRuleId, violation).severity),
          help: `${violation.description || violation.help} (${wcagLabel})`,
        },
      );
      seenSnippets.add(snippetKey);
    }
  }

  // Both engines can report the same underlying check (button-name/link-name ->
  // accessible-name, label/select-name -> form-label, tabindex ->
  // positive-tabindex, ...). Canonicalize every surfaced issue so one rule is
  // never counted twice. Only issues actually reported to the user count as
  // failures here: unsupported axe best-practice/page-level violations are
  // deliberately filtered out of `issues` above and must not create an
  // invisible failure that breaks the passed + failed === total arithmetic.
  const failedCanonicalRuleIds = new Set<AuditRuleId>(
    issues.map((issue) => canonicalRuleId(issue.ruleId)),
  );

  const evaluatedRules = new Map<AuditRuleId, AuditedRule>();
  for (const rule of AUDIT_RULES) {
    evaluatedRules.set(rule.id, { id: rule.id, description: rule.description });
  }
  const registerAxeRule = (report: AxeRuleReport) => {
    const id = canonicalRuleId(report.ruleId);
    if (evaluatedRules.has(id)) return;
    evaluatedRules.set(id, {
      id,
      description: report.description || report.help || `axe-core rule "${report.ruleId}"`,
    });
  };
  for (const pass of options.axePasses ?? []) registerAxeRule(pass);
  for (const violation of options.axeViolations ?? []) registerAxeRule(violation);

  const passedRules = Array.from(evaluatedRules.values()).filter(
    (rule) => !failedCanonicalRuleIds.has(rule.id),
  );
  // Exact rule-count math: passed + failed === total, so zero reported
  // violations always read X/X and N distinct failing rules read (X-N)/X.
  const totalRulesCount = passedRules.length + failedCanonicalRuleIds.size;

  return {
    snippetId,
    ranAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    issues,
    summary: {
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
      infos: issues.filter((issue) => issue.severity === 'info').length,
      passedRules,
      totalRules: totalRulesCount,
    },
  };
}

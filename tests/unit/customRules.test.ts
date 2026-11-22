import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRegisteredAuditRules,
  getRegisteredAuditRules,
  registerAuditRule,
} from '../../src/engine/audit/customRules.ts';
import { auditHtml } from '../../src/utils/wcagAuditor.ts';

afterEach(() => {
  clearRegisteredAuditRules();
});

describe('custom audit rules', () => {
  it('runs explicitly provided rules against matched elements', () => {
    const rule = {
      id: 'button-requires-testid',
      selector: 'button',
      message: 'Button is missing a data-testid attribute.',
      test: (element: Element) => element.hasAttribute('data-testid'),
    };

    const result = auditHtml('<button>Save</button><button data-testid="save">Save</button>', 'custom', {
      customRules: [rule],
    });

    expect(result.issues.map((issue) => issue.ruleId)).toContain('button-requires-testid');
    expect(result.issues.filter((issue) => issue.ruleId === 'button-requires-testid')).toHaveLength(1);
  });

  it('supports globally registered rules and cleanup', () => {
    const unregister = registerAuditRule({
      id: 'image-requires-decoding',
      selector: 'img',
      message: 'Image is missing a decoding attribute.',
      test: (element: Element) => element.hasAttribute('decoding'),
    });

    expect(getRegisteredAuditRules()).toHaveLength(1);
    expect(auditHtml('<img src="a.png" alt="A">', 'registered').issues.map((i) => i.ruleId)).toContain(
      'image-requires-decoding',
    );

    unregister();
    expect(getRegisteredAuditRules()).toHaveLength(0);
    expect(auditHtml('<img src="a.png" alt="A">', 'unregistered').issues.map((i) => i.ruleId)).not.toContain(
      'image-requires-decoding',
    );
  });

  it('clears all registered rules at once', () => {
    registerAuditRule({
      id: 'rule-one',
      selector: 'div',
      message: 'First custom rule.',
      test: () => false,
    });
    registerAuditRule({
      id: 'rule-two',
      selector: 'div',
      message: 'Second custom rule.',
      test: () => false,
    });

    clearRegisteredAuditRules();
    expect(getRegisteredAuditRules()).toHaveLength(0);
  });
});

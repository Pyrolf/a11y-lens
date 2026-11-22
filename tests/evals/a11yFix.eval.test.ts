import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDemoFix } from '../../src/engine/ai/providers/demo.ts';
import type { AiProviderConfig } from '../../src/types/ai.ts';
import type { CodeSnippet } from '../../src/types/editor.ts';
import { auditHtml } from '../../src/utils/wcagAuditor.ts';
import { EVAL_FIXTURES, type EvalFixture } from './fixtures.ts';

const DEMO_PROVIDER: AiProviderConfig = {
  id: 'demo',
  label: 'Demo AI Fix',
  requiresKey: false,
};

function makeSnippet(fixture: EvalFixture): CodeSnippet {
  const now = new Date().toISOString();
  return {
    id: fixture.id,
    name: fixture.name,
    language: 'html-tailwind',
    html: fixture.html,
    createdAt: now,
    updatedAt: now,
  };
}

interface EvalOutcome {
  fixture: EvalFixture;
  beforeRuleIds: string[];
  afterRuleIds: string[];
  resolved: boolean;
  introducedRules: string[];
}

async function runFixture(fixture: EvalFixture): Promise<EvalOutcome> {
  const before = auditHtml(fixture.html, fixture.id);
  const result = await createDemoFix({
    snippet: makeSnippet(fixture),
    issues: before.issues,
    provider: DEMO_PROVIDER,
  });
  const after = auditHtml(result.patchedHtml, fixture.id);
  const beforeRuleIds = before.issues.map((issue) => issue.ruleId);
  const afterRuleIds = after.issues.map((issue) => issue.ruleId);
  const introducedRules = Array.from(new Set(afterRuleIds)).filter(
    (ruleId) => !beforeRuleIds.includes(ruleId),
  );

  return {
    fixture,
    beforeRuleIds,
    afterRuleIds,
    resolved: !afterRuleIds.includes(fixture.expectedRuleId),
    introducedRules,
  };
}

describe('AI fix eval harness', () => {
  for (const fixture of EVAL_FIXTURES) {
    it(`resolves ${fixture.expectedRuleId}: ${fixture.name}`, async () => {
      const outcome = await runFixture(fixture);
      expect(outcome.beforeRuleIds).toContain(fixture.expectedRuleId);
      expect(outcome.afterRuleIds).not.toContain(fixture.expectedRuleId);
      expect(outcome.afterRuleIds.length).toBeLessThan(outcome.beforeRuleIds.length);
      expect(outcome.introducedRules).toEqual([]);
    });
  }

  it('keeps the aggregate demo-fix pass rate at or above 87.5%', async () => {
    const outcomes = await Promise.all(EVAL_FIXTURES.map(runFixture));
    const resolved = outcomes.filter((outcome) => outcome.resolved);
    const passRate = resolved.length / outcomes.length;

    expect(passRate).toBeGreaterThanOrEqual(0.875);
    expect(outcomes.filter((outcome) => outcome.introducedRules.length > 0)).toEqual([]);

    const report = {
      generatedAt: new Date().toISOString(),
      fixtureCount: outcomes.length,
      resolvedCount: resolved.length,
      passRate,
      threshold: 0.875,
      fixtures: outcomes.map((outcome) => ({
        id: outcome.fixture.id,
        expectedRuleId: outcome.fixture.expectedRuleId,
        resolved: outcome.resolved,
        introducedRules: outcome.introducedRules,
        beforeRules: outcome.beforeRuleIds,
        afterRules: outcome.afterRuleIds,
      })),
    };
    const reportPath = resolve('coverage', 'ai-fix-eval-summary.json');
    mkdirSync(resolve('coverage'), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  });
});

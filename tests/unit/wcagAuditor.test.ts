import { describe, expect, it } from 'vitest';
import type { AxeViolationReport, ComputedStyleEntry } from '../../src/types/audit.ts';
import { auditHtml } from '../../src/utils/wcagAuditor.ts';

function ruleIds(html: string): string[] {
  return auditHtml(html, 'unit-snippet').issues.map((issue) => issue.ruleId);
}

function computedEntry(overrides: Partial<ComputedStyleEntry> = {}): ComputedStyleEntry {
  return {
    tag: 'p',
    className: '',
    text: 'Hello world',
    selector: 'p',
    outerHTML: '<p>Hello world</p>',
    styles: {
      color: 'rgb(153, 153, 153)',
      'background-color': 'rgb(255, 255, 255)',
      'font-size': '16px',
      'font-weight': '400',
    },
    effectiveBackground: 'rgb(255, 255, 255)',
    ...overrides,
  };
}

describe('deterministic WCAG rules', () => {
  it('flags images without alt text but accepts decorative roles', () => {
    expect(ruleIds('<img src="hero.png">')).toContain('image-alt');
    expect(ruleIds('<img src="hero.png" alt="Team at work">')).not.toContain('image-alt');
    expect(ruleIds('<img src="divider.png" role="presentation">')).not.toContain('image-alt');
  });

  it('flags buttons and links without an accessible name', () => {
    expect(ruleIds('<button><svg aria-hidden="true"></svg></button>')).toContain(
      'accessible-name',
    );
    expect(ruleIds('<a href="/settings"><svg aria-hidden="true"></svg></a>')).toContain(
      'accessible-name',
    );
    expect(ruleIds('<button aria-label="Close dialog">×</button>')).not.toContain(
      'accessible-name',
    );
  });

  it('requires a programmatic label for form controls', () => {
    expect(ruleIds('<input id="email" placeholder="Email">')).toContain('form-label');
    expect(ruleIds('<input id="email" aria-label="Email">')).not.toContain('form-label');
    expect(
      ruleIds('<label for="email">Email</label><input id="email" type="email">'),
    ).not.toContain('form-label');
    expect(ruleIds('<label>Email<input type="email"></label>')).not.toContain('form-label');
    expect(ruleIds('<input type="hidden" name="token">')).not.toContain('form-label');
  });

  it('detects skipped heading levels and duplicate h1 elements', () => {
    expect(ruleIds('<h1>Title</h1><h4>Jump</h4>')).toContain('heading-order');
    expect(ruleIds('<h1>One</h1><h1>Two</h1>')).toContain('heading-order');
    expect(ruleIds('<h1>Title</h1><h2>Section</h2><h3>Detail</h3>')).not.toContain(
      'heading-order',
    );
  });

  it('flags vague link text', () => {
    expect(ruleIds('<a href="/pricing">Learn more</a>')).toContain('vague-link-text');
    expect(ruleIds('<a href="/pricing">View pricing plans</a>')).not.toContain(
      'vague-link-text',
    );
  });

  it('flags positive tabindex values', () => {
    expect(ruleIds('<div tabindex="3">Third</div>')).toContain('positive-tabindex');
    expect(ruleIds('<div tabindex="0">Natural</div>')).not.toContain('positive-tabindex');
    expect(ruleIds('<div tabindex="-1">Programmatic</div>')).not.toContain(
      'positive-tabindex',
    );
  });

  it('flags suppressed focus outlines without a focus-visible replacement', () => {
    expect(ruleIds('<button class="outline-none">Save</button>')).toContain('focus-outline');
    expect(
      ruleIds('<button class="outline-none focus-visible:outline-2">Save</button>'),
    ).not.toContain('focus-outline');
  });

  it('falls back to source-level contrast when computed styles are absent', () => {
    expect(
      ruleIds('<p style="color:#999;background-color:#fff">Low contrast</p>'),
    ).toContain('color-contrast');
    expect(
      ruleIds('<p style="color:#333;background-color:#fff">Readable</p>'),
    ).not.toContain('color-contrast');
  });

  it('uses WCAG large-text thresholds for bold 18.66px+ text', () => {
    expect(
      ruleIds(
        '<p style="color:#777;background:#fff;font-size:24px;font-weight:700">Large heading</p>',
      ),
    ).not.toContain('color-contrast');
  });
});

describe('computed-style contrast path', () => {
  it('reports a failing computed color pair', () => {
    const result = auditHtml('<p>Hello world</p>', 'computed', {
      computedStyles: [computedEntry()],
    });
    expect(result.issues.map((issue) => issue.ruleId)).toContain('color-contrast');
    expect(result.issues.find((issue) => issue.ruleId === 'color-contrast')?.details).toMatchObject({
      foreground: 'rgb(153, 153, 153)',
      background: 'rgb(255, 255, 255)',
      requiredRatio: 4.5,
    });
  });

  it('accepts a passing computed color pair', () => {
    const result = auditHtml('<p>Hello world</p>', 'computed', {
      computedStyles: [
        computedEntry({
          styles: {
            color: 'rgb(51, 51, 51)',
            'font-size': '16px',
            'font-weight': '400',
          },
        }),
      ],
    });
    expect(result.issues.map((issue) => issue.ruleId)).not.toContain('color-contrast');
  });

  it('ignores computed entries without text', () => {
    const result = auditHtml('<div></div>', 'computed', {
      computedStyles: [computedEntry({ text: '' })],
    });
    expect(result.issues.map((issue) => issue.ruleId)).not.toContain('color-contrast');
  });
});

describe('axe-core merge', () => {
  const frameViolation: AxeViolationReport = {
    ruleId: 'frame-title',
    description: 'Ensures every frame has an accessible title',
    help: 'Frames must have an accessible title',
    wcagTags: ['wcag2a', 'wcag412'],
    wcagCriterion: '4.1.2',
    wcagLevel: 'A',
    impact: 'serious',
    nodes: [{ selector: 'iframe', snippet: '<iframe src="/embed"></iframe>' }],
  };

  it('maps supported axe rules into the deterministic report', () => {
    const result = auditHtml('<iframe src="/embed"></iframe>', 'axe', {
      axeViolations: [frameViolation],
    });
    const issue = result.issues.find((candidate) => candidate.ruleId === 'frame-title');
    expect(issue).toBeDefined();
    expect(issue?.axeRuleId).toBe('frame-title');
    expect(issue?.severity).toBe('error');
  });

  it('deduplicates an axe finding already reported by the custom engine', () => {
    const result = auditHtml('<img src="hero.png">', 'axe', {
      axeViolations: [
        {
          ...frameViolation,
          ruleId: 'image-alt',
          wcagCriterion: '1.1.1',
          nodes: [{ selector: 'img', snippet: '<img src="hero.png">' }],
        },
      ],
    });
    expect(result.issues.filter((issue) => issue.ruleId === 'image-alt')).toHaveLength(1);
  });

  it('ignores unsupported axe best-practice rules', () => {
    const result = auditHtml('<main><p>Hello</p></main>', 'axe', {
      axeViolations: [
        {
          ...frameViolation,
          ruleId: 'region',
          description: 'All page content should be in landmarks',
          nodes: [{ selector: 'p', snippet: '<p>Hello</p>' }],
        },
      ],
    });
    expect(result.issues.map((issue) => issue.ruleId)).not.toContain('region');
  });

  it('registers axe passes in the evaluated-rule summary', () => {
    const result = auditHtml('<main><p>Hello</p></main>', 'axe', {
      axePasses: [
        {
          ruleId: 'landmark-one-main',
          description: 'Document has one main landmark',
          help: 'Document has one main landmark',
          wcagTags: ['best-practice'],
          wcagCriterion: 'Best practice',
          wcagLevel: 'Unknown',
        },
      ],
    });
    expect(result.summary.passedRules.map((rule) => rule.id)).toContain(
      'landmark-one-main',
    );
  });
});

describe('audit summary', () => {
  it('keeps severity counts and rule totals internally consistent', () => {
    const result = auditHtml(
      '<h1>Title</h1><h4>Jump</h4><img src="hero.png"><a href="/x">Learn more</a>',
      'summary',
    );
    expect(result.summary.errors + result.summary.warnings + result.summary.infos).toBe(
      result.issues.length,
    );
    expect(result.summary.passedRules.length + new Set(result.issues.map((i) => i.ruleId)).size)
      .toBeGreaterThanOrEqual(result.summary.totalRules);
  });

  it('adds line hints for multiline snippets', () => {
    const result = auditHtml('<div>\n  <img src="hero.png">\n</div>', 'lines');
    const issue = result.issues.find((candidate) => candidate.ruleId === 'image-alt');
    expect(issue?.node.lineHint).toBe(2);
  });
});

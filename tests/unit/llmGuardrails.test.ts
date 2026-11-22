import { describe, expect, it } from 'vitest';
import { normalizeHeadingOrder } from '../../src/engine/ai/normalizeHeadingOrder.ts';
import { postProcessLlmHtml } from '../../src/engine/ai/postProcessLlmHtml.ts';
import { sanitizeLlmHtml } from '../../src/engine/ai/sanitizeLlmHtml.ts';

describe('sanitizeLlmHtml', () => {
  it('extracts an html-labelled fenced block and drops prose', () => {
    const raw = 'Here is the fix:\n```html\n<button aria-label="Save">Save</button>\n```\nDone.';
    expect(sanitizeLlmHtml(raw)).toBe('<button aria-label="Save">Save</button>');
  });

  it('prefers the longest block when no html label is present', () => {
    const raw = '```\nshort\n```\n```\n<p>Longer block</p>\n<span>More</span>\n```';
    expect(sanitizeLlmHtml(raw)).toBe('<p>Longer block</p>\n<span>More</span>');
  });

  it('normalizes CRLF and trims surrounding whitespace', () => {
    const raw = '```html\r\n<p>Hello</p>\r\n```';
    expect(sanitizeLlmHtml(raw)).toBe('<p>Hello</p>');
  });

  it('removes stray fence markers from truncated output', () => {
    expect(sanitizeLlmHtml('```html\n<p>Truncated</p>')).toBe('<p>Truncated</p>');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeLlmHtml('   \n ')).toBe('');
  });
});

describe('normalizeHeadingOrder', () => {
  it('keeps the first h1 and demotes later h1 elements to h2', () => {
    expect(normalizeHeadingOrder('<h1>One</h1><h1 class="x">Two</h1>')).toBe(
      '<h1>One</h1><h2 class="x">Two</h2>',
    );
  });

  it('closes skipped heading levels relative to the previous heading', () => {
    expect(normalizeHeadingOrder('<h1>Title</h1><h4>Jump</h4>')).toBe(
      '<h1>Title</h1><h2>Jump</h2>',
    );
  });

  it('preserves attributes and closing tags', () => {
    expect(normalizeHeadingOrder('<h2 id="a">A</h2><h5 class="b">B</h5>')).toBe(
      '<h2 id="a">A</h2><h3 class="b">B</h3>',
    );
  });
});

describe('postProcessLlmHtml', () => {
  it('rewrites vague link text using the nearest heading context', () => {
    const result = postProcessLlmHtml(
      '<h2>Billing settings</h2><p>Manage your plan.</p><a href="/billing">Learn more</a>',
    );
    expect(result).toContain('aria-label="Read about Billing settings"');
    expect(result).toContain('>Read about Billing settings</a>');
  });

  it('adds accessible names to icon-only buttons', () => {
    const result = postProcessLlmHtml('<button><svg viewBox="0 0 24 24"></svg></button>');
    expect(result).toContain('aria-label="Action button"');
  });

  it('labels close buttons with a meaningful name', () => {
    const result = postProcessLlmHtml('<button class="close">×</button>');
    expect(result).toContain('aria-label="Close dialog"');
  });

  it('normalizes positive tabindex values while preserving zero and negatives', () => {
    expect(postProcessLlmHtml('<div tabindex="3">A</div>')).toBe('<div tabindex="0">A</div>');
    expect(postProcessLlmHtml('<div tabindex="0">A</div>')).toBe('<div tabindex="0">A</div>');
    expect(postProcessLlmHtml('<div tabindex="-1">A</div>')).toBe('<div tabindex="-1">A</div>');
  });

  it('leaves already-accessible markup unchanged', () => {
    const html =
      '<h1>Title</h1><h2>Section</h2><a href="/pricing">View pricing plans</a><button aria-label="Save">Save</button>';
    expect(postProcessLlmHtml(html)).toBe(html);
  });
});

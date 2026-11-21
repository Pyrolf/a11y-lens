import type { TextDiffLine } from '../../types/ai';

/**
 * Simple LCS-based line diff. Deterministic and runs entirely client-side.
 * Produces a unified diff with context lines for readability.
 */
export function buildDiff(before: string, after: string, context = 2): TextDiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  if (before === after) {
    return a.map((content, i) => ({ type: 'context', oldLineNumber: i + 1, newLineNumber: i + 1, content }));
  }

  const m = a.length;
  const n = b.length;
  // LCS table - fine for snippet-sized inputs.
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw: TextDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ type: 'context', oldLineNumber: i + 1, newLineNumber: j + 1, content: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'remove', oldLineNumber: i + 1, content: a[i] });
      i++;
    } else {
      raw.push({ type: 'add', newLineNumber: j + 1, content: b[j] });
      j++;
    }
  }
  while (i < m) { raw.push({ type: 'remove', oldLineNumber: i + 1, content: a[i] }); i++; }
  while (j < n) { raw.push({ type: 'add', newLineNumber: j + 1, content: b[j] }); j++; }

  // Collapse long unchanged runs, keeping `context` lines around changes.
  const keep = new Array(raw.length).fill(false);
  for (let k = 0; k < raw.length; k++) {
    if (raw[k].type !== 'context') {
      for (let c = Math.max(0, k - context); c <= Math.min(raw.length - 1, k + context); c++) keep[c] = true;
    }
  }
  // Always keep if small.
  if (raw.length <= 40) return raw;

  const out: TextDiffLine[] = [];
  let skipped = false;
  for (let k = 0; k < raw.length; k++) {
    if (keep[k]) { out.push(raw[k]); skipped = false; }
    else if (!skipped) {
      out.push({ type: 'context', content: '...' });
      skipped = true;
    }
  }
  return out;
}

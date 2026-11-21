/**
 * Deterministic heading normalization shared by the demo transformer and the
 * post-LLM safety net. Duplicate h1s are demoted to h2 *before* skipped levels
 * are closed, so the first h1 stays the page title and every rewritten tag
 * keeps its original attributes/classes verbatim.
 */

interface HeadingChange {
  index: number;
  length: number;
  level: number;
  newLevel: number;
  attrs: string;
}

function rewriteHeadingTags(html: string, changes: HeadingChange[]): string {
  let out = html;
  // Work backwards so earlier offsets stay valid after each replacement.
  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i];
    if (change.newLevel === change.level) continue;

    out = out.slice(0, change.index) +
      `<h${change.newLevel}${change.attrs}>` +
      out.slice(change.index + change.length);

    const closeMatch = new RegExp(`</h${change.level}>`, 'i').exec(out.slice(change.index));
    if (closeMatch) {
      const closeIndex = change.index + closeMatch.index;
      out = out.slice(0, closeIndex) +
        `</h${change.newLevel}>` +
        out.slice(closeIndex + closeMatch[0].length);
    }
  }
  return out;
}

/** Keeps the first h1 and demotes every later h1 to h2 (attributes preserved). */
function demoteDuplicateH1s(html: string): string {
  const changes: HeadingChange[] = [];
  let h1Count = 0;
  const re = /<h1\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    h1Count += 1;
    if (h1Count === 1) continue;
    changes.push({
      index: match.index,
      length: match[0].length,
      level: 1,
      newLevel: 2,
      attrs: match[1],
    });
  }

  return rewriteHeadingTags(html, changes);
}

/** Closes any level jump greater than one, relative to the preceding heading. */
function fixSkippedHeadingLevels(html: string): string {
  const changes: HeadingChange[] = [];
  let previous = 0;
  const re = /<h([1-6])\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const level = Number(match[1]);
    let newLevel = level;
    if (previous > 0 && newLevel > previous + 1) newLevel = previous + 1;
    if (newLevel !== level) {
      changes.push({
        index: match.index,
        length: match[0].length,
        level,
        newLevel,
        attrs: match[2],
      });
    }
    previous = newLevel;
  }

  return rewriteHeadingTags(html, changes);
}

/** Demotes duplicate h1s first, then normalizes skipped heading levels. */
export function normalizeHeadingOrder(html: string): string {
  return fixSkippedHeadingLevels(demoteDuplicateH1s(html));
}

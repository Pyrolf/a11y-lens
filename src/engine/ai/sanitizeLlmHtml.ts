/**
 * LLMs often ignore the "no markdown" instruction and wrap HTML in fences.
 * Extract the fenced block when present so only the actual snippet reaches the
 * diff (and, later, the editor). Handles `html`-labelled, bare and uppercase
 * fences, leading/trailing prose, and CRLF line endings.
 */
export function sanitizeLlmHtml(raw: string): string {
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (!text) return '';

  const lines = text.split('\n');
  const openings: Array<{ index: number; language: string }> = [];
  lines.forEach((line, index) => {
    const match = /^\s*```\s*([a-zA-Z0-9_-]+)?\s*$/.exec(line);
    if (match) openings.push({ index, language: (match[1] ?? '').toLowerCase() });
  });

  const blocks = openings
    .map((opening) => {
      const closeIndex = lines.findIndex(
        (line, index) => index > opening.index && /^\s*```\s*$/.test(line),
      );
      return closeIndex === -1 ? null : { ...opening, closeIndex };
    })
    .filter((block): block is { index: number; language: string; closeIndex: number } => block !== null);

  if (blocks.length > 0) {
    const htmlBlock = blocks.find((block) => block.language === 'html' || block.language === 'htm');
    const chosen = htmlBlock ?? blocks.reduce((longest, block) =>
      block.closeIndex - block.index > longest.closeIndex - longest.index ? block : longest,
    );
    return lines.slice(chosen.index + 1, chosen.closeIndex).join('\n').trim();
  }

  // No complete fence pair: drop stray markers from truncated output.
  return lines.filter((line) => !/^\s*```/.test(line)).join('\n').trim();
}

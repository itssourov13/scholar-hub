/**
 * Pure text parsing for the "Bulk Import" experimental admin feature.
 * Splits a pasted numbered list (e.g. a LinkedIn scholarship round-up post)
 * into individual { title, link } items. No server-only imports — safe to
 * use directly in the client for instant preview before submitting.
 */

export type BulkImportItem = {
  /** Stable client-side id for tracking progress in the UI. */
  clientId: string;
  title: string;
  link: string | null;
  /** The raw block of text this item was parsed from, for debugging. */
  raw: string;
};

const NUMBERED_LINE = /^\s*(\d+)[.)]\s+(.+?)\s*$/;
const URL_RE = /https?:\/\/[^\s"'<>)）]+/i;

const cleanUrl = (raw: string): string => raw.replace(/[.,;]+$/, "");

export function parseBulkPost(text: string): BulkImportItem[] {
  const lines = text.split(/\r?\n/);
  const items: BulkImportItem[] = [];
  let current: { title: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const block = current.lines.join("\n");
    const urlMatch = block.match(URL_RE);
    items.push({
      clientId: `item-${items.length}-${Math.random().toString(36).slice(2, 8)}`,
      title: current.title.trim(),
      link: urlMatch ? cleanUrl(urlMatch[0]) : null,
      raw: `${current.title}\n${block}`.trim(),
    });
    current = null;
  };

  for (const line of lines) {
    const numbered = line.match(NUMBERED_LINE);
    if (numbered) {
      flush();
      current = { title: numbered[2], lines: [] };
    } else if (current && line.trim()) {
      current.lines.push(line.trim());
    }
  }
  flush();

  // Fallback: if nothing matched the numbered-list pattern (e.g. admin pasted
  // a single scholarship, or used a different list format), treat the whole
  // paste as one item so the page still does something sensible.
  if (items.length === 0 && text.trim()) {
    const urlMatch = text.match(URL_RE);
    const firstLine = text.trim().split(/\r?\n/)[0] ?? "";
    items.push({
      clientId: `item-0-${Math.random().toString(36).slice(2, 8)}`,
      title: firstLine.trim(),
      link: urlMatch ? cleanUrl(urlMatch[0]) : null,
      raw: text.trim(),
    });
  }

  return items;
}

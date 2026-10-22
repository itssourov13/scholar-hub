/**
 * Deadline parsing/status helpers, mirroring the web app's logic in
 * apps/web/src/app/scholarships/scholarships-client.tsx so both clients
 * classify scholarships identically (open now / opening soon / closed).
 */

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Builds the date from parts because Hermes' `new Date(string)` only accepts ISO. */
function fromParts(day: string, monthName: string, year: string): Date | null {
  const month = MONTHS[monthName.toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(Number(year), month, Number(day));
  return isNaN(date.getTime()) ? null : date;
}

/** Parses "2026-09-01", "1 September 2026", or "September 1, 2026". */
export function parseDeadlineDate(d: string): Date | null {
  const s = d.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(date.getTime()) ? null : date;
  }
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmy) return fromParts(dmy[1], dmy[2], dmy[3]);
  const mdy = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdy) return fromParts(mdy[2], mdy[1], mdy[3]);
  return null;
}

/** Unparseable or missing deadlines count as not expired (rolling/open). */
export function isExpired(d: string | null): boolean {
  if (!d) return false;
  const date = parseDeadlineDate(d);
  return date ? date.getTime() < Date.now() : false;
}

export function isClosingSoon(d: string | null): boolean {
  if (!d) return false;
  const date = parseDeadlineDate(d);
  if (!date) return false;
  const diff = date.getTime() - Date.now();
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000;
}

/** Expired within the last ~90 days — the "recently closed" window. */
export function isRecentlyClosed(d: string | null): boolean {
  if (!d) return false;
  const date = parseDeadlineDate(d);
  if (!date) return false;
  const msSince = Date.now() - date.getTime();
  return msSince > 0 && msSince < 90 * 24 * 60 * 60 * 1000;
}

/**
 * Sorts scholarships by deadline ascending (soonest first), mirroring the
 * web app's default "Deadline" sort in scholarships-client.tsx:
 * open deadlines first (soonest → latest), then no-deadline/unparseable
 * items, then expired ones — with flagship items pinned to the top within
 * that order.
 */
export function sortByDeadline<T extends { deadline: string | null; is_flagship?: boolean | null }>(
  list: T[],
): T[] {
  const now = Date.now();
  const bucket = (d: string | null) => {
    if (!d) return 1;
    const parsed = parseDeadlineDate(d);
    if (!parsed) return 1;
    return parsed.getTime() > now ? 0 : 2;
  };

  const sorted = [...list].sort((a, b) => {
    const ba = bucket(a.deadline);
    const bb = bucket(b.deadline);
    if (ba !== bb) return ba - bb;
    const ta = a.deadline ? (parseDeadlineDate(a.deadline)?.getTime() ?? Infinity) : Infinity;
    const tb = b.deadline ? (parseDeadlineDate(b.deadline)?.getTime() ?? Infinity) : Infinity;
    return ta - tb;
  });

  return sorted.sort((a, b) => {
    if (!!a.is_flagship === !!b.is_flagship) return 0;
    return a.is_flagship ? -1 : 1;
  });
}

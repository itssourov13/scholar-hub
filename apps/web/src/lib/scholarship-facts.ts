/**
 * Canonical rendering of scholarship facts for LLM consumption.
 *
 * Both the RAG ingest path and the chat retrieval path format scholarships
 * through here so the model always sees deadlines, funding and eligibility in
 * the same shape. Retrieval reads these values straight from the `scholarships`
 * table at request time, which is what stops the model from paraphrasing a
 * deadline it half-remembers from a prose chunk.
 */

export type ScholarshipFactRow = {
  id: string;
  title: string;
  country: string | null;
  degree_level: string | null;
  funding_type: string | null;
  deadline: string | null;
  is_live: boolean | null;
  opening_note: string | null;
  official_url: string | null;
  competitiveness: string | null;
  eligibility_summary: string | null;
  slug: string | null;
};

/** Columns every fact-rendering query must select. Keep in sync with the type above. */
export const SCHOLARSHIP_FACT_COLUMNS =
  "id, title, country, degree_level, funding_type, deadline, is_live, opening_note, official_url, competitiveness, eligibility_summary, slug";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type DeadlineSource = Pick<ScholarshipFactRow, "deadline" | "is_live" | "opening_note">;

/**
 * Renders the stored deadline verbatim. `deadline` is free text (it may hold
 * "Rolling", "TBA" or an ISO date), so ISO values are echoed with a spelled-out
 * form alongside them — models rewrite `2026-06-05` into the wrong month far
 * more often when they have to do the conversion themselves.
 */
export const formatDeadline = (row: DeadlineSource): string => {
  const raw = row.deadline?.trim();

  if (!raw) {
    if (row.is_live === false) {
      return row.opening_note?.trim() || "Not yet announced — applications have not opened";
    }
    return "Not listed in the ScholarHub database";
  }

  const iso = ISO_DATE.exec(raw);
  if (!iso) return raw;

  const [, year, month, day] = iso;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return raw;

  return `${raw} (${Number(day)} ${monthName} ${year})`;
};

/** Days until an ISO deadline, or null when the deadline is not a plain date. */
export const daysUntilDeadline = (deadline: string | null, now = new Date()): number | null => {
  const iso = ISO_DATE.exec(deadline?.trim() ?? "");
  if (!iso) return null;

  const target = Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
};

/**
 * Compact identity line prefixed onto every RAG chunk so a retrieved fragment
 * from the middle of a description still names its scholarship and deadline.
 */
export const scholarshipTag = (row: DeadlineSource & { title: string; country: string | null }): string => {
  const country = row.country ? ` — ${row.country}` : "";
  return `[${row.title}${country} | Deadline: ${formatDeadline(row)}]`;
};

/** Full authoritative fact sheet for one scholarship. */
export const formatScholarshipFacts = (row: ScholarshipFactRow, now = new Date()): string => {
  const days = daysUntilDeadline(row.deadline, now);
  const status =
    row.is_live === false
      ? `Not open yet${row.opening_note ? ` — ${row.opening_note}` : ""}`
      : days === null
        ? "Open"
        : days < 0
          ? `Closed ${Math.abs(days)} day(s) ago`
          : `Open — ${days} day(s) left`;

  return [
    `Scholarship: ${row.title}`,
    `Country: ${row.country ?? "Not specified"}`,
    `Degree level: ${row.degree_level ?? "Not specified"}`,
    `Funding: ${row.funding_type ?? "Not specified"}`,
    `Deadline (exact, as published on ScholarHub): ${formatDeadline(row)}`,
    `Application status: ${status}`,
    row.competitiveness ? `Competitiveness: ${row.competitiveness}` : null,
    row.eligibility_summary ? `Eligibility: ${row.eligibility_summary}` : null,
    `Official URL: ${row.official_url ?? "Not specified"}`,
  ]
    .filter(Boolean)
    .join("\n");
};

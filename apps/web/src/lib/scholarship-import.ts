import { createHash } from "node:crypto";
import { isIP } from "node:net";

export type RawScholarshipRecord = {
  title?: unknown;
  country?: unknown;
  university?: unknown;
  degree?: unknown;
  funding?: unknown;
  deadline?: unknown;
  official_link?: unknown;
  telegram_date?: unknown;
  summary?: unknown;
};

export type ExistingScholarship = {
  id: string;
  title: string;
  country: string;
  official_url: string | null;
  slug: string | null;
  source_dataset?: string | null;
  source_record_id?: string | null;
};

export type ImportDecision = {
  rowNumber: number;
  decision: "importable" | "needs_review" | "already_imported";
  reasons: string[];
  warnings: string[];
  sourceRecordId: string | null;
  normalizedUrl: string | null;
  record: {
    title: string;
    country: string;
    degreeLevel: string | null;
    fundingType: string | null;
    deadline: string | null;
    officialUrl: string;
    rawDescription: string | null;
    sourceObservedAt: string | null;
    slugBase: string;
  } | null;
};

export const SOURCE_DATASET = "cleaned_scholarships.json";

export function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

export function normalizeIdentityText(value: unknown): string {
  return textValue(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}

/** Normalises only URL differences that normally do not change the resource. */
export function normalizeOfficialUrl(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const ipHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
    const ipLiteral = isIP(ipHost) !== 0;
    if (
      ipLiteral ||
      !host.includes(".") ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) return null;
    url.hostname = host;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_[^=]+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
      url.port = "";
    }
    url.searchParams.sort();
    const normalized = url.toString();
    return normalized.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function mapDegreeLevels(value: unknown): string | null {
  const inputs = Array.isArray(value) ? value : [value];
  const output: string[] = [];
  for (const item of inputs) {
    const raw = textValue(item).toLowerCase().replace(/[.]/g, "").trim();
    let mapped: string | null = null;
    if (/^(bachelor|bachelors|bachelor'?s|undergraduate|undergrad|bsc|ba|btech)$/.test(raw)) mapped = "bachelors";
    else if (/^(master|masters|master'?s|postgraduate|graduate|msc|ma|mba)$/.test(raw)) mapped = "masters";
    else if (/^(phd|ph d|doctorate|doctoral|doctor of philosophy)$/.test(raw)) mapped = "phd";
    else if (/^(postdoc|postdoctoral|post doctoral)$/.test(raw)) mapped = "postdoc";
    else if (/^(any|all|all levels|any level)$/.test(raw)) mapped = "any";
    if (mapped && !output.includes(mapped)) output.push(mapped);
  }
  const order = ["bachelors", "masters", "phd", "postdoc", "any"];
  output.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return output.length ? output.join(" | ") : null;
}

function mapFundingType(value: unknown): string | null {
  const raw = textValue(value).toLowerCase().replace(/[_-]+/g, " ");
  if (!raw) return null;
  if (/partial/.test(raw)) return "partial";
  if (/tuition (waiver|only|fee)|tuition waiver/.test(raw)) return "tuition_only";
  if (/stipend/.test(raw) && !/fully funded|full funding/.test(raw)) return "stipend";
  if (/fully funded|full funded|full funding|fully funded scholarship/.test(raw)) return "full";
  if (/tuition/.test(raw)) return "tuition_only";
  if (/stipend/.test(raw)) return "stipend";
  return null;
}

function parseObservedAt(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function scholarshipSourceRecordId(record: RawScholarshipRecord): string {
  const url = normalizeOfficialUrl(record.official_link) ?? textValue(record.official_link).toLowerCase();
  const identity = [
    normalizeIdentityText(record.title),
    normalizeIdentityText(record.country),
    url,
  ].join("|");
  return createHash("sha256").update(identity).digest("hex");
}

function slugBase(title: string, country: string, fingerprint: string): string {
  const ascii = `${title} ${country}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return ascii || `scholarship-${fingerprint.slice(0, 12)}`;
}

function pastIsoDeadline(value: string, asOf: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < asOf.getTime();
}

export function assessScholarshipDataset(
  rows: RawScholarshipRecord[],
  existing: ExistingScholarship[] = [],
  asOf = new Date(),
): ImportDecision[] {
  const prepared = rows.map((raw, index) => {
    const title = textValue(raw.title);
    const country = textValue(raw.country);
    const url = normalizeOfficialUrl(raw.official_link);
    const sourceRecordId = title ? scholarshipSourceRecordId(raw) : null;
    return { raw, rowNumber: index + 1, title, country, url, sourceRecordId };
  });

  const byUrl = new Map<string, number[]>();
  const byTitleCountry = new Map<string, number[]>();
  for (const item of prepared) {
    if (item.url) byUrl.set(item.url, [...(byUrl.get(item.url) ?? []), item.rowNumber]);
    if (item.title && item.country) {
      const key = `${normalizeIdentityText(item.title)}|${normalizeIdentityText(item.country)}`;
      byTitleCountry.set(key, [...(byTitleCountry.get(key) ?? []), item.rowNumber]);
    }
  }

  const existingByUrl = new Map<string, ExistingScholarship[]>();
  const existingByTitleCountry = new Map<string, ExistingScholarship[]>();
  for (const item of existing) {
    const url = normalizeOfficialUrl(item.official_url);
    if (url) existingByUrl.set(url, [...(existingByUrl.get(url) ?? []), item]);
    const key = `${normalizeIdentityText(item.title)}|${normalizeIdentityText(item.country)}`;
    existingByTitleCountry.set(key, [...(existingByTitleCountry.get(key) ?? []), item]);
  }

  return prepared.map((item) => {
    const { raw, rowNumber, title, country, url, sourceRecordId } = item;
    const reasons: string[] = [];
    const warnings: string[] = [];
    const sourceAlreadyExists = existing.some(
      (entry) => entry.source_dataset === SOURCE_DATASET && entry.source_record_id === sourceRecordId,
    );

    if (sourceAlreadyExists) {
      reasons.push("source_record_already_imported");
      return { rowNumber, decision: "already_imported", reasons, warnings, sourceRecordId, normalizedUrl: url, record: null };
    }
    if (!title) reasons.push("missing_title");
    if (!country) reasons.push("missing_country_required_by_schema");
    if (!textValue(raw.official_link)) reasons.push("missing_official_url");
    else if (!url) reasons.push("invalid_or_unsafe_official_url");

    if (url && (byUrl.get(url)?.length ?? 0) > 1) reasons.push("duplicate_url_within_source_dataset");
    if (title && country) {
      const key = `${normalizeIdentityText(title)}|${normalizeIdentityText(country)}`;
      if ((byTitleCountry.get(key)?.length ?? 0) > 1) reasons.push("duplicate_title_and_country_within_source_dataset");
      if ((existingByTitleCountry.get(key)?.length ?? 0) > 0) reasons.push("title_and_country_already_in_database");
    }
    if (url && (existingByUrl.get(url)?.length ?? 0) > 0) reasons.push("official_url_already_in_database");

    if (!mapDegreeLevels(raw.degree)) warnings.push("degree_level_missing_or_unrecognised");
    if (!mapFundingType(raw.funding)) warnings.push("funding_type_missing_or_unrecognised");
    const summary = textValue(raw.summary);
    if (!summary) warnings.push("summary_missing");
    const deadline = textValue(raw.deadline);
    if (!deadline) warnings.push("deadline_missing_verify_current_cycle");
    else if (pastIsoDeadline(deadline, asOf)) warnings.push("deadline_is_past_verify_new_cycle");
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) warnings.push("deadline_needs_manual_format_and_cycle_check");
    if (!url) warnings.push("official_source_not_verified");
    else warnings.push("official_source_not_yet_checked_live");
    const observedAt = parseObservedAt(raw.telegram_date);
    if (!observedAt) warnings.push("source_post_date_missing_or_invalid");

    const decision = reasons.length ? "needs_review" : "importable";
    const record = decision === "importable" ? {
      title,
      country,
      degreeLevel: mapDegreeLevels(raw.degree),
      fundingType: mapFundingType(raw.funding),
      deadline: deadline || null,
      officialUrl: textValue(raw.official_link),
      rawDescription: summary || null,
      sourceObservedAt: observedAt,
      slugBase: slugBase(title, country, sourceRecordId ?? scholarshipSourceRecordId(raw)),
    } : null;

    return { rowNumber, decision, reasons, warnings, sourceRecordId, normalizedUrl: url, record };
  });
}

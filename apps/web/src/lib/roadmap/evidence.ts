/**
 * Evidence requirements, keyed by milestone, and the per-country document set.
 *
 * Why this file exists rather than living in `catalog.ts`: the scorer needs both
 * tables. `evidenceSatisfied` / `satisfyEvidence` / `projectedReadiness` need to
 * know what stored thing each milestone requires, and the `country_docs` bucket
 * needs to know which document keys the resolved country asks for. Neither can
 * come from `catalog.ts` or `country-rules.ts` without `scoring.ts` depending on
 * the catalog, which would put the whole milestone set behind the score.
 *
 * So the two tables live here, and `catalog.ts` / `country-rules.ts` read them:
 *   * `MilestoneDef.evidence` is `MILESTONE_EVIDENCE[key]`
 *   * `CountryRule.countryDocKeys` is `COUNTRY_DOC_KEYS[code]`
 *   * `CountryRule.aliases` is `COUNTRY_ALIASES[code]`
 *   * `resolveCountry` wraps `resolveCountryCode`
 *
 * Restating any of them in those files would be a second source of truth for a
 * fact the scorer already depends on.
 *
 * Pure: no I/O, no clock.
 */

import type { Bilingual, CountryCode, DocKey, EvidenceRequirement, MilestoneKey } from "./types";

/** The six document buckets the Documents pillar is split into. Bucket weights
 *  live with the scorer, since they are per-weighting-column integers. */
export type DocBucket = "passport" | "cv" | "sop" | "transcripts" | "lor" | "country_docs";

const label = (en: string, bn: string): Bilingual => ({ en, bn });

/**
 * What each milestone requires before its completion can move a pillar.
 *
 * `apply` and `visa` are `null` on purpose: no table records a submitted
 * application or an issued visa, so recording either moves no pillar. They exist
 * to close the path honestly. `passport` does carry evidence, because a Docs_Map
 * entry backs it.
 */
export const MILESTONE_EVIDENCE: Record<MilestoneKey, EvidenceRequirement | null> = {
  profile_basics: {
    kind: "profile_field",
    field: "cgpa",
    label: label("your CGPA", "আপনার সিজিপিএ"),
  },
  target_choice: {
    kind: "profile_field",
    field: "target_country",
    label: label("your target country", "আপনার লক্ষ্য দেশ"),
  },
  passport: {
    kind: "docs_status",
    docKey: "passport",
    label: label("a valid passport", "একটি বৈধ পাসপোর্ট"),
  },
  english_test: {
    kind: "profile_field",
    field: "ielts_score",
    label: label("your English test score", "আপনার ইংরেজি টেস্ট স্কোর"),
  },
  transcripts: {
    kind: "docs_status",
    docKey: "transcripts",
    label: label("your transcripts", "আপনার ট্রান্সক্রিপ্ট"),
  },
  cv: {
    kind: "artefact",
    artefact: "user_cv",
    label: label("a CV in the builder", "বিল্ডারে তৈরি একটি CV"),
  },
  sop: {
    kind: "docs_status",
    docKey: "sop",
    label: label("your statement of purpose", "আপনার স্টেটমেন্ট অফ পারপাস"),
  },
  lor: {
    kind: "docs_count",
    docKey: "lor_count",
    atLeast: 2,
    label: label("at least 2 recommendation letters", "কমপক্ষে ২টি সুপারিশপত্র"),
  },
  shortlist: {
    kind: "artefact",
    artefact: "bookmarks",
    atLeast: 3,
    label: label("at least 3 saved scholarships", "কমপক্ষে ৩টি সংরক্ষিত স্কলারশিপ"),
  },
  funding_plan: {
    kind: "docs_status",
    docKey: "funding_proof",
    label: label("proof of funds", "তহবিলের প্রমাণ"),
  },
  apply: null,
  visa: null,
  aps_germany: {
    kind: "docs_status",
    docKey: "aps",
    label: label("your APS certificate", "আপনার APS সার্টিফিকেট"),
  },
  blocked_account_germany: {
    kind: "docs_status",
    docKey: "blocked_account",
    label: label("your blocked account", "আপনার ব্লকড অ্যাকাউন্ট"),
  },
  proof_of_funds_canada: {
    kind: "docs_status",
    docKey: "proof_of_funds",
    label: label("proof of funds", "তহবিলের প্রমাণ"),
  },
  pal_canada: {
    kind: "docs_status",
    docKey: "pal",
    label: label("your provincial attestation letter", "আপনার প্রাদেশিক সত্যায়ন পত্র"),
  },
  i20_usa: {
    kind: "docs_status",
    docKey: "i20",
    label: label("your I-20", "আপনার I-20"),
  },
  ds160_usa: {
    kind: "docs_status",
    docKey: "ds160",
    label: label("your DS-160 confirmation", "আপনার DS-160 নিশ্চিতকরণ"),
  },
  cas_uk: {
    kind: "docs_status",
    docKey: "cas",
    label: label("your CAS statement", "আপনার CAS স্টেটমেন্ট"),
  },
  ihs_uk: {
    kind: "docs_status",
    docKey: "ihs",
    label: label("your IHS payment", "আপনার IHS পেমেন্ট"),
  },
  professor_contact_japan: {
    kind: "docs_status",
    docKey: "professor_contact",
    label: label("a professor's acceptance", "একজন অধ্যাপকের সম্মতি"),
  },
  coe_japan: {
    kind: "docs_status",
    docKey: "coe",
    label: label("your Certificate of Eligibility", "আপনার Certificate of Eligibility"),
  },
};

export function evidenceFor(key: MilestoneKey): EvidenceRequirement | null {
  return MILESTONE_EVIDENCE[key] ?? null;
}

/** Which milestone's evidence names each document bucket, where one does. Used by
 *  the weakness selector to prefer an evidence-named diagnosis. */
export const DOC_BUCKET_EVIDENCE: Partial<Record<DocBucket, MilestoneKey>> = {
  passport: "passport",
  cv: "cv",
  sop: "sop",
  transcripts: "transcripts",
  lor: "lor",
};

/**
 * The document keys each country path requires, all landing in the single
 * 2-point `country_docs` bucket. That is what keeps the Documents pillar total
 * fixed at every country: Germany's APS and blocked account cost the same points
 * as the Generic_Path's proof of funds, rather than each adding new points and
 * breaking the 100 sum.
 */
export const COUNTRY_DOC_KEYS: Record<CountryCode, readonly DocKey[]> = {
  germany: ["aps", "blocked_account"],
  canada: ["proof_of_funds", "pal"],
  usa: ["i20", "ds160"],
  uk: ["cas", "ihs"],
  japan: ["professor_contact", "coe"],
  generic: ["funding_proof"],
};

/**
 * Lowercased alias lists, matched exactly against a trimmed, lowercased
 * `target_country`.
 *
 * Latin script only, deliberately. A Bangla country name ("জার্মানি") falls
 * through to the Generic_Path, which is the honest outcome while the wizard is
 * the only writer of `target_country` and writes the English name it offered.
 * Adding Bangla aliases is a `country-rules.ts` decision, not a scoring one.
 */
export const COUNTRY_ALIASES: Record<Exclude<CountryCode, "generic">, readonly string[]> = {
  germany: ["germany", "deutschland", "german", "de", "deu"],
  canada: ["canada", "ca", "can"],
  usa: [
    "usa",
    "us",
    "u.s.",
    "u.s.a.",
    "united states",
    "united states of america",
    "america",
  ],
  uk: ["uk", "u.k.", "united kingdom", "britain", "great britain", "england", "scotland"],
  japan: ["japan", "jp", "nippon"],
};

/**
 * `target_country` → country code. Lowercases, trims, matches an alias exactly,
 * and falls back to `generic` — which also covers `null` and the comma-joined
 * multi-country string a student may have typed.
 */
export function resolveCountryCode(target: string | null | undefined): CountryCode {
  if (typeof target !== "string") return "generic";
  const needle = target.trim().toLowerCase();
  if (needle === "") return "generic";
  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.includes(needle)) return code as CountryCode;
  }
  return "generic";
}

/** The document keys the student's resolved country requires. */
export function countryDocKeysFor(target: string | null | undefined): readonly DocKey[] {
  return COUNTRY_DOC_KEYS[resolveCountryCode(target)];
}

/**
 * Five country paths plus the Generic_Path.
 *
 * A rule adds milestones and adjusts durations; it never replaces the catalog.
 * That is what keeps the twelve country-independent steps identical everywhere
 * and confines the country-specific surface to two extra milestones and two
 * document keys per country.
 *
 * Three tables are read from `evidence.ts` rather than restated here, because
 * `scoring.ts` already depends on them and a second copy would eventually
 * disagree with the score:
 *
 *   * `countryDocKeys` is `COUNTRY_DOC_KEYS[code]` — the keys the `country_docs`
 *     bucket reads
 *   * `aliases` is `COUNTRY_ALIASES[code]`
 *   * `resolveCountry` wraps `resolveCountryCode`
 *
 * The five countries are the design's default set. Task 3.1 records the
 * `profiles.preferred_countries` distribution query in
 * `apps/web/supabase/queries/preferred-countries-distribution.sql`; until
 * somebody runs it against production the ranking is unverified and these five
 * stand (Req 8.2, 8.3).
 *
 * Pure: no I/O, no clock.
 */

import { COUNTRY_ALIASES, COUNTRY_DOC_KEYS, MILESTONE_EVIDENCE, resolveCountryCode } from "./evidence";
import type { MilestoneDef } from "./catalog";
import { evidenceSatisfied } from "./scoring";
import type {
  Bilingual,
  CountryCode,
  CountrySource,
  DocKey,
  IntakeTerm,
  MilestoneKey,
  RoadmapInputs,
} from "./types";

export type { CountryCode } from "./types";

export type CountryRule = {
  code: CountryCode;
  /** Lowercased, matched exactly against a trimmed, lowercased `target_country`. */
  aliases: readonly string[];
  label: Bilingual;
  extraMilestones: readonly MilestoneDef[];
  etaOverrides: Partial<Record<MilestoneKey, number>>;
  /** Feeds the `country_docs` bucket of the Documents pillar. */
  countryDocKeys: readonly DocKey[];
  /** 1-12, the first month of each term's intake in this country. */
  intakeStartMonth: Record<IntakeTerm, number>;
};

const bi = (en: string, bn: string): Bilingual => ({ en, bn });

const always = () => true;

/** Every country addition carries a `docs_status` Evidence_Requirement, so all of
 *  them are auto-satisfied by the same table the scorer reads. */
function extra(def: Omit<MilestoneDef, "appliesTo" | "isSatisfied" | "evidence">): MilestoneDef {
  return {
    ...def,
    evidence: MILESTONE_EVIDENCE[def.key],
    appliesTo: always,
    isSatisfied: (inputs: RoadmapInputs) => evidenceSatisfied(inputs, def.key),
  };
}

// ── Germany ─────────────────────────────────────────────────────────────────

const GERMANY: CountryRule = {
  code: "germany",
  aliases: COUNTRY_ALIASES.germany,
  label: bi("Germany", "জার্মানি"),
  extraMilestones: [
    extra({
      key: "aps_germany",
      stage: "documents",
      title: bi("Get your APS certificate", "APS সার্টিফিকেট নিন"),
      description: bi(
        "Bangladeshi students must have their degrees verified by the APS office before a German university will look at the application. It takes weeks, and nothing downstream moves without it.",
        "জার্মান বিশ্ববিদ্যালয় আবেদন দেখার আগেই বাংলাদেশি শিক্ষার্থীদের ডিগ্রি APS অফিস থেকে যাচাই করাতে হয়। এতে কয়েক সপ্তাহ লাগে, আর এটি ছাড়া পরের কিছুই এগোয় না।",
      ),
      etaDays: 45,
      dependsOn: ["transcripts"],
      priority: 13,
      pillar: "documents",
      action: { kind: "guide", slug: "aps-certificate-bangladesh" },
    }),
    extra({
      key: "blocked_account_germany",
      stage: "visa",
      title: bi("Open your blocked account", "ব্লকড অ্যাকাউন্ট খুলুন"),
      description: bi(
        "The visa needs a year of living costs sitting in a blocked account in your name. Open it as soon as you have an offer — the transfer itself takes time.",
        "ভিসার জন্য এক বছরের জীবনযাত্রার খরচ আপনার নামে ব্লকড অ্যাকাউন্টে থাকতে হয়। অফার পাওয়ার সাথে সাথেই খুলুন — টাকা পাঠাতেই সময় লাগে।",
      ),
      etaDays: 21,
      dependsOn: ["apply"],
      priority: 14,
      pillar: "documents",
      action: { kind: "guide", slug: "blocked-account-germany" },
    }),
  ],
  // The APS step sits in front of the German admission cycle, so documents that
  // feed it are worth starting earlier than the generic estimate.
  etaOverrides: { transcripts: 21 },
  countryDocKeys: COUNTRY_DOC_KEYS.germany,
  // Two intakes: Sommersemester in April, Wintersemester in October.
  intakeStartMonth: { spring: 4, summer: 4, fall: 10, winter: 10 },
};

// ── Canada ──────────────────────────────────────────────────────────────────

const CANADA: CountryRule = {
  code: "canada",
  aliases: COUNTRY_ALIASES.canada,
  label: bi("Canada", "কানাডা"),
  extraMilestones: [
    extra({
      key: "proof_of_funds_canada",
      stage: "visa",
      title: bi("Prepare your proof of funds", "তহবিলের প্রমাণ তৈরি করুন"),
      description: bi(
        "IRCC wants tuition plus living costs shown in a GIC or a bank statement in your own name. Move the money early so the statement has some history to it.",
        "IRCC চায় টিউশন আর জীবনযাত্রার খরচ আপনার নিজের নামে GIC বা ব্যাংক স্টেটমেন্টে দেখানো হোক। টাকা আগেই সরান, যাতে স্টেটমেন্টে কিছুটা পুরোনো রেকর্ড থাকে।",
      ),
      etaDays: 14,
      dependsOn: ["apply"],
      priority: 15,
      pillar: "documents",
      action: { kind: "guide", slug: "proof-of-funds" },
    }),
    extra({
      key: "pal_canada",
      stage: "visa",
      title: bi("Get your provincial attestation letter", "প্রাদেশিক সত্যায়ন পত্র (PAL) নিন"),
      description: bi(
        "Most study permit applications now need a PAL from the province your university sits in. The university requests it, but only after you accept the offer.",
        "এখন বেশিরভাগ study permit আবেদনে আপনার বিশ্ববিদ্যালয় যে প্রদেশে, সেখানকার PAL লাগে। বিশ্ববিদ্যালয়ই এটি চেয়ে নেয়, তবে অফার গ্রহণ করার পরেই।",
      ),
      etaDays: 30,
      dependsOn: ["apply"],
      priority: 16,
      pillar: "documents",
      action: { kind: "guide", slug: "provincial-attestation-letter" },
    }),
  ],
  etaOverrides: {},
  countryDocKeys: COUNTRY_DOC_KEYS.canada,
  // Fall in September, Winter in January, Spring/Summer intakes in May.
  intakeStartMonth: { spring: 5, summer: 5, fall: 9, winter: 1 },
};

// ── USA ─────────────────────────────────────────────────────────────────────

const USA: CountryRule = {
  code: "usa",
  aliases: COUNTRY_ALIASES.usa,
  label: bi("United States", "যুক্তরাষ্ট্র"),
  extraMilestones: [
    extra({
      key: "i20_usa",
      stage: "visa",
      title: bi("Receive your I-20", "আপনার I-20 নিন"),
      description: bi(
        "The university issues the I-20 once it has your admission and your funding documents. You cannot pay SEVIS or book a visa interview without it.",
        "ভর্তি আর ফান্ডিং ডকুমেন্ট পাওয়ার পর বিশ্ববিদ্যালয় I-20 ইস্যু করে। এটি ছাড়া SEVIS ফি দেওয়া বা ভিসা ইন্টারভিউ নেওয়া যায় না।",
      ),
      etaDays: 21,
      dependsOn: ["apply"],
      priority: 17,
      pillar: "documents",
      action: { kind: "guide", slug: "i20-and-sevis" },
    }),
    extra({
      key: "ds160_usa",
      stage: "visa",
      title: bi("File your DS-160", "DS-160 ফর্ম জমা দিন"),
      description: bi(
        "Fill the DS-160 with the exact names and dates on your I-20, pay the fee, then book the Dhaka interview slot. Slots move fast between May and August.",
        "I-20 তে যেভাবে নাম আর তারিখ আছে, ঠিক সেভাবেই DS-160 পূরণ করুন, ফি দিন, তারপর ঢাকার ইন্টারভিউ স্লট নিন। মে থেকে অগাস্টে স্লট দ্রুত শেষ হয়।",
      ),
      etaDays: 7,
      dependsOn: ["i20_usa"],
      priority: 18,
      pillar: "documents",
      action: { kind: "guide", slug: "ds160-student-visa" },
    }),
  ],
  etaOverrides: {},
  countryDocKeys: COUNTRY_DOC_KEYS.usa,
  // Fall in August, Spring in January, a small Summer intake in May.
  intakeStartMonth: { spring: 1, summer: 5, fall: 8, winter: 1 },
};

// ── UK ──────────────────────────────────────────────────────────────────────

const UK: CountryRule = {
  code: "uk",
  aliases: COUNTRY_ALIASES.uk,
  label: bi("United Kingdom", "যুক্তরাজ্য"),
  extraMilestones: [
    extra({
      key: "cas_uk",
      stage: "visa",
      title: bi("Get your CAS statement", "CAS স্টেটমেন্ট নিন"),
      description: bi(
        "The university issues the CAS after you accept the offer and pay the deposit. The visa application quotes its number, so nothing starts until it lands.",
        "অফার গ্রহণ করে ডিপোজিট দেওয়ার পর বিশ্ববিদ্যালয় CAS ইস্যু করে। ভিসা আবেদনে এর নম্বর দিতে হয়, তাই এটি না এলে কিছুই শুরু হয় না।",
      ),
      etaDays: 21,
      dependsOn: ["apply"],
      priority: 19,
      pillar: "documents",
      action: { kind: "guide", slug: "cas-statement-uk" },
    }),
    extra({
      key: "ihs_uk",
      stage: "visa",
      title: bi("Pay the health surcharge", "হেলথ সারচার্জ (IHS) দিন"),
      description: bi(
        "The immigration health surcharge is paid inside the visa application and covers your NHS access. Keep the receipt — the visa centre asks for it.",
        "ভিসা আবেদনের ভেতরেই immigration health surcharge দিতে হয়, এতে NHS সুবিধা পাওয়া যায়। রিসিটটি রাখুন — ভিসা সেন্টার এটি চায়।",
      ),
      etaDays: 3,
      dependsOn: ["cas_uk"],
      priority: 20,
      pillar: "documents",
      action: { kind: "guide", slug: "uk-student-visa-costs" },
    }),
  ],
  etaOverrides: {},
  countryDocKeys: COUNTRY_DOC_KEYS.uk,
  // September is the main intake, January the secondary one.
  intakeStartMonth: { spring: 1, summer: 6, fall: 9, winter: 1 },
};

// ── Japan ───────────────────────────────────────────────────────────────────

const JAPAN: CountryRule = {
  code: "japan",
  aliases: COUNTRY_ALIASES.japan,
  label: bi("Japan", "জাপান"),
  extraMilestones: [
    extra({
      key: "professor_contact_japan",
      stage: "applications",
      title: bi("Find a supervising professor", "একজন সুপারভাইজার অধ্যাপক খুঁজুন"),
      description: bi(
        "Most Japanese programmes, and every MEXT scholarship, want a professor who has agreed to supervise you before you apply. Read two of their papers before you write.",
        "জাপানের বেশিরভাগ প্রোগ্রাম, আর প্রতিটি MEXT স্কলারশিপ চায় আবেদনের আগেই একজন অধ্যাপক আপনাকে supervise করতে রাজি হন। লেখার আগে তাঁর দুটি পেপার পড়ে নিন।",
      ),
      etaDays: 30,
      dependsOn: ["target_choice"],
      priority: 21,
      pillar: "documents",
      action: { kind: "mentor", seedKey: "professor_outreach" },
    }),
    extra({
      key: "coe_japan",
      stage: "visa",
      title: bi("Wait for your Certificate of Eligibility", "Certificate of Eligibility এর জন্য অপেক্ষা করুন"),
      description: bi(
        "The university applies to immigration on your behalf and the COE comes back in about six weeks. The visa itself is quick once it arrives.",
        "বিশ্ববিদ্যালয় আপনার হয়ে ইমিগ্রেশনে আবেদন করে, আর COE আসতে প্রায় ছয় সপ্তাহ লাগে। এটি এসে গেলে ভিসা পেতে বেশি সময় লাগে না।",
      ),
      etaDays: 45,
      dependsOn: ["apply"],
      priority: 22,
      pillar: "documents",
      action: { kind: "guide", slug: "certificate-of-eligibility-japan" },
    }),
  ],
  // Professor contact has to start long before the application window, so the
  // shortlist and the application itself are given more room.
  etaOverrides: { shortlist: 14 },
  countryDocKeys: COUNTRY_DOC_KEYS.japan,
  // April is the main intake, September/October the English-track one.
  intakeStartMonth: { spring: 4, summer: 4, fall: 9, winter: 4 },
};

// ── Generic ─────────────────────────────────────────────────────────────────

/**
 * The path used when `target_country` matches nothing — including `null`, a
 * Bangla country name and the comma-joined multi-country string a student may
 * have typed. No extra milestones, and one funding document, so the
 * `country_docs` bucket stays the same size as every other country's.
 */
export const GENERIC_RULE: CountryRule = {
  code: "generic",
  aliases: [],
  label: bi("your target country", "আপনার লক্ষ্য দেশ"),
  extraMilestones: [],
  etaOverrides: {},
  countryDocKeys: COUNTRY_DOC_KEYS.generic,
  // Northern-hemisphere defaults; a real country overrides all four.
  intakeStartMonth: { spring: 1, summer: 6, fall: 9, winter: 1 },
};

export const COUNTRY_RULES: readonly CountryRule[] = [GERMANY, CANADA, USA, UK, JAPAN];

const BY_CODE = new Map<CountryCode, CountryRule>([
  ...COUNTRY_RULES.map((rule) => [rule.code, rule] as const),
  ["generic", GENERIC_RULE] as const,
]);

export function countryRuleFor(code: CountryCode): CountryRule {
  return BY_CODE.get(code) ?? GENERIC_RULE;
}

/**
 * `target_country` → the rule that governs the path.
 *
 * `source` is `rules` only when an alias matched: it is what the client uses to
 * decide whether to prompt "you listed several countries — pick the one you're
 * planning for" (Req 5.7, 5.8, 8.5).
 */
export function resolveCountry(target: string | null): { rule: CountryRule; source: CountrySource } {
  const code = resolveCountryCode(target);
  return { rule: countryRuleFor(code), source: code === "generic" ? "generic" : "rules" };
}

/** Every extra milestone any rule declares, for the tests that check key and
 *  priority uniqueness across the whole definition set. */
export const ALL_EXTRA_MILESTONES: readonly MilestoneDef[] = COUNTRY_RULES.flatMap(
  (rule) => rule.extraMilestones,
);

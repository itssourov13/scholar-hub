/**
 * The twelve country-independent milestones, and the copy that describes them.
 *
 * Three rules hold across every entry.
 *
 * **Evidence is read, never restated.** `MilestoneDef.evidence` is
 * `MILESTONE_EVIDENCE[key]` from `evidence.ts`. The scorer already depends on
 * that table — `evidenceSatisfied`, `satisfyEvidence` and `projectedReadiness`
 * all read it — so a second copy here would be a second source of truth for the
 * fact that decides whether a completion moves a pillar.
 *
 * **Auto-satisfaction is exactly the evidence.** `isSatisfied` delegates to
 * `evidenceSatisfied`, so a milestone is auto-`done` when, and only when, the
 * stored thing it requires is in place. `apply` and `visa` carry no evidence and
 * are never auto-satisfied: no table records a submitted application or an
 * issued visa, and `evidenceSatisfied` returning `true` for "nothing to prove"
 * must not be mistaken for proof.
 *
 * **Copy is bilingual and written here, not by the model.** The narrator adds a
 * "why this matters for you" per key and can be absent; title and description
 * always render. Bangla keeps IELTS, CGPA, SOP, LOR and CV in Latin script,
 * matching `apps/mobile/src/i18n/translations.ts`.
 *
 * Pure: no I/O, no clock.
 */

import { evidenceFor, MILESTONE_EVIDENCE } from "./evidence";
import { evidenceSatisfied } from "./scoring";
import type {
  ActionTarget,
  Bilingual,
  EvidenceRequirement,
  MilestoneKey,
  PillarKey,
  RoadmapInputs,
  Stage,
  StrengthKey,
  WeaknessKey,
} from "./types";

export type MilestoneDef = {
  key: MilestoneKey;
  stage: Stage;
  title: Bilingual;
  description: Bilingual;
  etaDays: number;
  dependsOn: MilestoneKey[];
  /** Lower runs earlier on ties. Unique across the catalog and every country
   *  rule, so the topological order is total whatever path is assembled. */
  priority: number;
  pillar: PillarKey | null;
  /** Read from `MILESTONE_EVIDENCE`; `null` ⇒ sequencing only. */
  evidence: EvidenceRequirement | null;
  action: ActionTarget;
  /** Count-tracking milestones only. `PATCH` accepts `progress` in 0…this. */
  targetCount?: number;
  appliesTo: (inputs: RoadmapInputs) => boolean;
  isSatisfied: (inputs: RoadmapInputs) => boolean;
};

const bi = (en: string, bn: string): Bilingual => ({ en, bn });

/** Every milestone applies unless a rule says otherwise. */
const always = () => true;

/** Auto-satisfaction reads the same table the scorer does. A milestone with no
 *  Evidence_Requirement can never be proven by stored data, so it stays manual. */
function satisfiedByEvidence(key: MilestoneKey): (inputs: RoadmapInputs) => boolean {
  if (MILESTONE_EVIDENCE[key] === null) return () => false;
  return (inputs) => evidenceSatisfied(inputs, key);
}

/** A declared waiver — Medium of Instruction, or an outright waiver — removes the
 *  test from the path rather than leaving a step the student cannot complete.
 *  `graph.ts` drops dependencies on milestones the filter removed. */
function englishTestApplies(inputs: RoadmapInputs): boolean {
  return !(
    inputs.english.type === "moi" ||
    inputs.english.type === "waiver" ||
    inputs.english.status === "waived"
  );
}

/**
 * The twelve, in catalog order. `priority` matches that order, which is also the
 * tie-break the topological sort applies when two milestones are both ready.
 *
 * `dependsOn` is a real dependency, not a suggestion: `sop` needs the CV because
 * the statement reuses it, and `apply` needs everything a submission carries.
 */
export const CATALOG: readonly MilestoneDef[] = [
  {
    key: "profile_basics",
    stage: "foundation",
    title: bi("Fill in your profile basics", "প্রোফাইলের মূল তথ্য দিন"),
    description: bi(
      "Add your target degree and CGPA. These two decide how every other part of your profile is weighed, so the score stays blank until they are in.",
      "আপনার target degree আর CGPA যোগ করুন। এই দুটোই ঠিক করে দেয় বাকি সবকিছু কীভাবে হিসাব হবে, তাই এগুলো না দিলে স্কোর দেখানো হয় না।",
    ),
    etaDays: 1,
    dependsOn: [],
    priority: 1,
    pillar: "academics",
    evidence: MILESTONE_EVIDENCE.profile_basics,
    action: { kind: "form", section: "academics" },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("profile_basics"),
  },
  {
    key: "target_choice",
    stage: "foundation",
    title: bi("Pick one country and one intake", "একটি দেশ আর একটি intake বাছুন"),
    description: bi(
      "Every step after this one is shaped by where and when you are applying. Pick the country you are actually planning for, even if you are still comparing.",
      "এরপরের প্রতিটি ধাপ নির্ভর করে আপনি কোথায় আর কখন আবেদন করছেন তার উপর। এখনও তুলনা করলেও, যেটির জন্য সত্যিই প্রস্তুতি নিচ্ছেন সেটিই বাছুন।",
    ),
    etaDays: 2,
    dependsOn: [],
    priority: 2,
    // Shapes the path rather than earning points.
    pillar: null,
    evidence: MILESTONE_EVIDENCE.target_choice,
    action: { kind: "form", section: "target" },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("target_choice"),
  },
  {
    key: "passport",
    stage: "foundation",
    title: bi("Get your passport in hand", "পাসপোর্ট হাতে নিন"),
    description: bi(
      "You need a passport valid well past your intake — start early, because the e-passport queue in Dhaka runs into weeks, not days.",
      "আপনার intake এর অনেক পরেও মেয়াদ আছে এমন পাসপোর্ট লাগবে — আগেই শুরু করুন, কারণ ঢাকায় e-passport এর লাইনে কয়েক দিন নয়, কয়েক সপ্তাহ যায়।",
    ),
    etaDays: 21,
    dependsOn: [],
    priority: 3,
    pillar: "documents",
    evidence: MILESTONE_EVIDENCE.passport,
    action: { kind: "guide", slug: "passport-for-students" },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("passport"),
  },
  {
    key: "english_test",
    stage: "testing",
    title: bi("Take your English test", "ইংরেজি টেস্ট দিন"),
    description: bi(
      "Book IELTS or TOEFL, then enter the band you scored. Most programmes ask for 6.5 overall, and the score is the single largest thing you can still change.",
      "IELTS বা TOEFL এর তারিখ নিন, তারপর প্রাপ্ত ব্যান্ড যোগ করুন। বেশিরভাগ প্রোগ্রাম overall 6.5 চায়, আর এই স্কোরই এখন সবচেয়ে বড় পরিবর্তন আনতে পারে।",
    ),
    etaDays: 60,
    dependsOn: ["target_choice"],
    priority: 4,
    pillar: "english",
    evidence: MILESTONE_EVIDENCE.english_test,
    action: { kind: "guide", slug: "ielts-preparation" },
    appliesTo: englishTestApplies,
    isSatisfied: satisfiedByEvidence("english_test"),
  },
  {
    key: "transcripts",
    stage: "documents",
    title: bi("Collect and attest your transcripts", "ট্রান্সক্রিপ্ট তুলুন ও সত্যায়ন করান"),
    description: bi(
      "Order sealed transcripts and mark sheets from your university, then get them attested. Universities in Bangladesh take their time, so this one waits for nobody.",
      "বিশ্ববিদ্যালয় থেকে সিলগালা ট্রান্সক্রিপ্ট ও মার্কশিট তুলুন, তারপর সত্যায়ন করান। এখানে বিশ্ববিদ্যালয়গুলো সময় নেয়, তাই এটি ফেলে রাখা যাবে না।",
    ),
    etaDays: 14,
    dependsOn: ["profile_basics"],
    priority: 5,
    pillar: "documents",
    evidence: MILESTONE_EVIDENCE.transcripts,
    action: { kind: "guide", slug: "transcript-attestation" },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("transcripts"),
  },
  {
    key: "cv",
    stage: "documents",
    title: bi("Build your academic CV", "একাডেমিক CV তৈরি করুন"),
    description: bi(
      "Build one CV in the builder and reuse it everywhere. An academic CV is not a job CV: education, research and publications come first.",
      "CV Builder দিয়ে একটি CV তৈরি করুন আর সব জায়গায় সেটিই ব্যবহার করুন। একাডেমিক CV চাকরির CV নয় — শিক্ষা, গবেষণা আর প্রকাশনা আগে আসে।",
    ),
    etaDays: 3,
    dependsOn: ["profile_basics"],
    priority: 6,
    pillar: "documents",
    evidence: MILESTONE_EVIDENCE.cv,
    action: { kind: "cv" },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("cv"),
  },
  {
    key: "sop",
    stage: "documents",
    title: bi("Write your statement of purpose", "আপনার SOP লিখুন"),
    description: bi(
      "One page on what you want to study, why there, and what you have already done about it. Draft it with the mentor, then say it in your own words.",
      "এক পৃষ্ঠায় লিখুন কী পড়তে চান, কেন সেখানে, আর এ নিয়ে এখন পর্যন্ত কী করেছেন। মেন্টরের সাথে খসড়া করুন, তারপর নিজের ভাষায় লিখুন।",
    ),
    etaDays: 10,
    dependsOn: ["target_choice", "cv"],
    priority: 7,
    pillar: "documents",
    evidence: MILESTONE_EVIDENCE.sop,
    action: { kind: "mentor", seedKey: "sop" },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("sop"),
  },
  {
    key: "lor",
    stage: "documents",
    title: bi("Line up your recommendation letters", "LOR গুছিয়ে নিন"),
    description: bi(
      "Ask two or three teachers who actually supervised you, and give each of them your CV and your deadline. Two letters is the floor; three is safer.",
      "যাঁরা সত্যিই আপনাকে দেখেছেন এমন দুই-তিনজন শিক্ষককে অনুরোধ করুন, আর প্রত্যেককে আপনার CV আর ডেডলাইন দিন। দুটি LOR সর্বনিম্ন, তিনটি হলে নিরাপদ।",
    ),
    etaDays: 21,
    dependsOn: ["profile_basics"],
    priority: 8,
    pillar: "documents",
    evidence: MILESTONE_EVIDENCE.lor,
    action: { kind: "mentor", seedKey: "lor" },
    targetCount: 3,
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("lor"),
  },
  {
    key: "shortlist",
    stage: "applications",
    title: bi("Shortlist at least three scholarships", "কমপক্ষে তিনটি স্কলারশিপ shortlist করুন"),
    description: bi(
      "Save the scholarships you mean to apply to. Three is the minimum worth calling a plan — one deadline slipping should not end your cycle.",
      "যেগুলোতে সত্যিই আবেদন করবেন, সেগুলো সেভ করুন। তিনটি হলে সেটাকে প্ল্যান বলা যায় — একটি ডেডলাইন হাতছাড়া হলেই যেন সব শেষ না হয়।",
    ),
    etaDays: 7,
    dependsOn: ["target_choice"],
    priority: 9,
    pillar: "application_progress",
    evidence: MILESTONE_EVIDENCE.shortlist,
    // `graph.ts` fills the filters in from the student's country and degree.
    action: { kind: "discover", filters: {} },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("shortlist"),
  },
  {
    key: "funding_plan",
    stage: "applications",
    title: bi("Put your funding plan on paper", "ফান্ডিং প্ল্যান লিখে ফেলুন"),
    description: bi(
      "Work out what the scholarship covers and what you cover, then get the bank documents that prove it. Every visa office asks for this in some form.",
      "স্কলারশিপ কী কী দেবে আর কী আপনাকে দিতে হবে হিসাব করুন, তারপর সেটির ব্যাংক ডকুমেন্ট নিন। প্রতিটি ভিসা অফিসই কোনো না কোনো রূপে এটি চায়।",
    ),
    etaDays: 14,
    dependsOn: ["shortlist"],
    priority: 10,
    pillar: "documents",
    evidence: MILESTONE_EVIDENCE.funding_plan,
    action: { kind: "guide", slug: "proof-of-funds" },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("funding_plan"),
  },
  {
    key: "apply",
    stage: "applications",
    title: bi("Submit your applications", "আবেদন জমা দিন"),
    description: bi(
      "Upload each portal's own form of the documents you have built, and submit before the deadline in the university's timezone, not yours.",
      "যে ডকুমেন্টগুলো তৈরি করেছেন, প্রতিটি পোর্টালের নিজের ফরম্যাটে আপলোড করুন, আর ডেডলাইনের আগে জমা দিন — বিশ্ববিদ্যালয়ের সময় অনুযায়ী, আপনার নয়।",
    ),
    etaDays: 21,
    dependsOn: ["sop", "lor", "transcripts", "english_test", "shortlist"],
    priority: 11,
    // No table records a submitted application, so this moves no pillar. It is
    // here to close the path honestly.
    pillar: null,
    evidence: MILESTONE_EVIDENCE.apply,
    action: { kind: "discover", filters: {} },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("apply"),
  },
  {
    key: "visa",
    stage: "visa",
    title: bi("Apply for your student visa", "স্টুডেন্ট ভিসার আবেদন করুন"),
    description: bi(
      "With an offer in hand, book the appointment and take the funding and academic documents you already have. Slots in Dhaka go fast in peak season.",
      "অফার হাতে পেলে অ্যাপয়েন্টমেন্ট নিন, আর আগে থেকেই তৈরি ফান্ডিং ও একাডেমিক ডকুমেন্ট নিয়ে যান। পিক সিজনে ঢাকার স্লট দ্রুত শেষ হয়।",
    ),
    etaDays: 30,
    dependsOn: ["apply"],
    priority: 12,
    pillar: null,
    evidence: MILESTONE_EVIDENCE.visa,
    action: { kind: "guide", slug: "student-visa-bangladesh" },
    appliesTo: always,
    isSatisfied: satisfiedByEvidence("visa"),
  },
];

export const CATALOG_KEYS: readonly MilestoneKey[] = CATALOG.map((def) => def.key);

const BY_KEY = new Map<string, MilestoneDef>(CATALOG.map((def) => [def.key, def]));

/** The country-independent definition for a key, or `null`. Country additions
 *  live in `country-rules.ts` and are looked up through `milestoneDefsFor`. */
export function milestoneByKey(key: string): MilestoneDef | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Seeded chat prompts for the `mentor` action target, keyed by `seedKey`.
 *
 * Written as the student's own opening line, because that is what
 * `chat-handoff.ts` puts in the composer — a prompt phrased as an instruction to
 * the model reads as somebody else's words the moment it appears on screen.
 */
export const MENTOR_SEEDS: Record<string, Bilingual> = {
  sop: bi(
    "Help me draft a statement of purpose. Ask me what I need to decide first, then work through it one section at a time.",
    "আমার SOP এর খসড়া করতে সাহায্য করুন। প্রথমে জিজ্ঞেস করুন কী কী ঠিক করতে হবে, তারপর একটি একটি অংশ ধরে এগোন।",
  ),
  lor: bi(
    "Help me ask a teacher for a recommendation letter. Draft the request, and tell me what to send along with it.",
    "একজন শিক্ষকের কাছে LOR চাইতে সাহায্য করুন। অনুরোধটি লিখে দিন, আর বলুন এর সাথে কী কী পাঠাতে হবে।",
  ),
  professor_outreach: bi(
    "Help me write a first email to a professor in Japan about supervision. Keep it short, and tell me what to attach.",
    "জাপানের একজন অধ্যাপককে supervision নিয়ে প্রথম ইমেইল লিখতে সাহায্য করুন। সংক্ষিপ্ত রাখুন, আর বলুন কী কী attach করতে হবে।",
  ),
};

/**
 * The no-AI phrasing for a derived Strength or Weakness.
 *
 * The wire's `RoadmapNote.text` is not optional, and the engine's `DerivedNote`
 * carries only a key — so something has to phrase these before narration lands,
 * and `narrate.ts` needs the same sentences as its per-key fallback (validator
 * step 9). The mobile app also keys its own copy by `StrengthKey` /
 * `WeaknessKey` for the offline case (Req 7.14); that is the design's stated
 * arrangement, not a duplicate of this table.
 */
export const NOTE_COPY: Record<StrengthKey | WeaknessKey, Bilingual> = {
  // ── Strengths ──
  strong_cgpa: bi("Your CGPA is working in your favour", "আপনার CGPA আপনার পক্ষে কাজ করছে"),
  strong_english: bi("Your English score is where it needs to be", "আপনার ইংরেজি স্কোর যেখানে দরকার, সেখানেই আছে"),
  documents_ready: bi("Your documents are nearly all in place", "আপনার ডকুমেন্ট প্রায় সবই তৈরি"),
  research_output: bi("Your research output stands out", "আপনার গবেষণার কাজ আলাদা করে চোখে পড়ে"),
  work_experience: bi("Your work experience adds real weight", "আপনার কাজের অভিজ্ঞতা সত্যিকারের ওজন যোগ করছে"),
  active_shortlist: bi("You have a real shortlist going", "আপনার একটি সত্যিকারের shortlist দাঁড়িয়ে গেছে"),
  // ── Weaknesses ──
  low_cgpa: bi(
    "Your CGPA is below what most programmes look for",
    "বেশিরভাগ প্রোগ্রাম যা চায়, আপনার CGPA তার নিচে",
  ),
  no_english_test: bi("You have no English test score yet", "আপনার এখনও কোনো ইংরেজি টেস্ট স্কোর নেই"),
  weak_english_band: bi(
    "Your English band is below the usual 6.5 floor",
    "আপনার ইংরেজি ব্যান্ড সাধারণ 6.5 এর নিচে",
  ),
  missing_documents: bi("Your transcripts are still missing", "আপনার ট্রান্সক্রিপ্ট এখনও নেই"),
  no_sop: bi("Your statement of purpose is not ready", "আপনার SOP এখনও তৈরি নয়"),
  no_lor: bi("You are short of recommendation letters", "আপনার LOR এর সংখ্যা কম"),
  no_cv: bi("You have no CV built yet", "আপনার এখনও কোনো CV তৈরি হয়নি"),
  no_research: bi("You have no research output recorded", "আপনার কোনো গবেষণার কাজ যোগ করা নেই"),
  no_experience: bi("You have no work experience recorded", "আপনার কোনো কাজের অভিজ্ঞতা যোগ করা নেই"),
  empty_shortlist: bi("You have not saved any scholarships", "আপনি এখনও কোনো স্কলারশিপ সেভ করেননি"),
};

/** The label naming what a milestone still needs, or `null` when it needs
 *  nothing. Read from `evidence.ts` so the wording lives in one place. */
export function evidenceLabelFor(key: MilestoneKey): Bilingual | null {
  return evidenceFor(key)?.label ?? null;
}

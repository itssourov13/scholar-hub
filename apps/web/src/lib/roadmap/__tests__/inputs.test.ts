import fc from "fast-check";
import { describe, expect, test } from "vitest";

import {
  countFromProse,
  knownInputs,
  monthsFromProse,
  normalizeDocs,
  parseCgpa,
  parseDegree,
  parseEnglishBand,
  splitCountries,
  toRoadmapInputs,
  unknownInputs,
  REQUIRED_INPUT_KEYS,
} from "../inputs";
import { scoreProfile } from "../scoring";
import type { InputKey, PillarKey } from "../types";
import { arbSignals, arbUnparseableProse } from "./arbitraries";

const NO_SIGNALS = { bookmarkCount: 0, cvCount: 0 };

// ── Property 8 ───────────────────────────────────────────────────────────────

// Feature: roadmap, Property 8: For any string that no parser can read as a
// number, the corresponding input field is null, its InputKey is absent from the
// known set, and its pillar reports known: false.
test("unparseable is unknown, never zero", () => {
  fc.assert(
    fc.property(
      arbUnparseableProse,
      arbUnparseableProse,
      arbUnparseableProse,
      arbUnparseableProse,
      arbUnparseableProse,
      arbSignals(),
      (cgpa, ielts, papers, work, docs, signals) => {
        // Nothing else is set: no english_test_status, no docs map, no degree. So
        // each of these five columns is the only evidence its input has.
        const inputs = toRoadmapInputs(
          {
            cgpa,
            ielts_score: ielts,
            published_papers: papers,
            work_experience: work,
            internships: work,
            docs,
          },
          { ...signals, cvCount: 0 },
        );

        expect(inputs.cgpa).toBeNull();
        expect(inputs.english.band).toBeNull();
        expect(inputs.english.status).toBeNull();
        expect(inputs.research.papers).toBeNull();
        expect(inputs.experience.workMonths).toBeNull();
        expect(inputs.experience.internshipMonths).toBeNull();
        expect(inputs.docs).toEqual({});

        const unknown = unknownInputs(inputs);
        for (const key of ["cgpa", "english", "research", "experience", "docs"] as InputKey[]) {
          expect(unknown).toContain(key);
          expect(knownInputs(inputs)).not.toContain(key);
        }

        const breakdown = scoreProfile(inputs);
        const pillar = (key: PillarKey) =>
          breakdown.pillars.find((entry) => entry.pillar === key)!;

        for (const key of [
          "academics",
          "english",
          "research",
          "experience",
          "documents",
        ] as PillarKey[]) {
          expect(pillar(key).known, key).toBe(false);
        }
        // Unparseable text earns nothing, and — the part that matters — it is not
        // recorded as a known zero, so none of these pillars can produce a
        // Weakness.
        for (const key of ["academics", "english", "research", "experience"] as PillarKey[]) {
          expect(pillar(key).earned, key).toBe(0);
        }
      },
    ),
    { numRuns: 100 },
  );
});

// ── The parsers, by worked example ───────────────────────────────────────────

describe("parseCgpa", () => {
  test.each([
    ["3.65", { value: 3.65, scale: 4 }],
    [3.65, { value: 3.65, scale: 4 }],
    ["4.2", { value: 4.2, scale: 5 }],
    // A comma decimal is ordinary data entry here, not a typo.
    ["3,65", { value: 3.65, scale: 4 }],
    ["3.40 out of 4", { value: 3.4, scale: 4 }],
    ["N/A", null],
    ["", null],
    [null, null],
    [undefined, null],
    // A percentage the profile route accepts and stores. Neither scale fits, and
    // guessing one would hand a typo full marks.
    ["85", null],
    [85, null],
    [0, null],
    ["abc", null],
  ])("parseCgpa(%o) → %o", (raw, expected) => {
    expect(parseCgpa(raw)).toEqual(expected);
  });
});

describe("parseEnglishBand", () => {
  test.each([
    ["7.5", null, 7.5],
    ["IELTS 6.5 overall", null, 6.5],
    // The published ETS table: 94-101 is IELTS 7.0, 79-93 is 6.5.
    ["TOEFL 95", null, 7],
    ["TOEFL 94", null, 7],
    ["TOEFL 93", null, 6.5],
    ["TOEFL 92", null, 6.5],
    ["95", "toefl", 7],
    ["92", "toefl", 6.5],
    ["102", "toefl", 7.5],
    ["Duolingo 120", null, 7],
    ["PTE 65", null, 7],
    // A student with type toefl who typed the band itself.
    ["6.5", "toefl", 6.5],
    ["planned", null, null],
    ["", null, null],
    [null, null, null],
    ["will take in June", null, null],
    // The guard that keeps a date out of the band: a bare number above 9 with no
    // test named is unknown, not a converted score.
    ["will take on 12 June", null, null],
    ["2026-09-01", null, null],
  ] as const)("parseEnglishBand(%o, %o) → %o", (raw, type, expected) => {
    expect(parseEnglishBand(raw, type)).toBe(expected);
  });
});

describe("countFromProse", () => {
  test.each([
    ["2 published, 1 under review", 2],
    ["3", 3],
    // Declared zeros: known values, and the only way a Weakness can be derived
    // from a text field.
    ["none", 0],
    ["0", 0],
    ["nil", 0],
    ["N/A", 0],
    // Unparseable prose: unknown, so it costs Confidence instead.
    ["some conference work", null],
    ["", null],
    [null, null],
  ])("countFromProse(%o) → %o", (raw, expected) => {
    expect(countFromProse(raw)).toBe(expected);
  });
});

describe("monthsFromProse", () => {
  test.each([
    ["2 years 6 months", 30],
    ["18 months", 18],
    ["3 years at Brac", 36],
    ["1.5 years", 18],
    ["fresher", 0],
    ["none", 0],
    ["", null],
    [null, null],
    // No unit: six months or six years? Guessing either flatters or shortchanges.
    ["6", null],
    ["some freelance work", null],
  ])("monthsFromProse(%o) → %o", (raw, expected) => {
    expect(monthsFromProse(raw)).toBe(expected);
  });
});

describe("parseDegree", () => {
  test.each([
    ["masters", "master"],
    ["Masters", "master"],
    ["PhD", "phd"],
    ["Bachelor", "bachelor"],
    ["bsc", "bachelor"],
    ["MSc in CS", "master"],
    ["diploma", null],
    ["not sure yet", null],
    ["", null],
    [null, null],
  ])("parseDegree(%o) → %o", (raw, expected) => {
    expect(parseDegree(raw)).toBe(expected);
  });
});

describe("normalizeDocs", () => {
  test("keeps allow-listed keys and in-domain values, drops the rest", () => {
    expect(
      normalizeDocs({
        passport: "ready",
        sop: "in_progress",
        transcripts: "eventually",
        from_a_newer_client: "ready",
        lor_count: 3,
      }),
    ).toEqual({ passport: "ready", sop: "in_progress", lor_count: 3 });
  });

  test("clamps lor_count to its declared 0-5 domain", () => {
    expect(normalizeDocs({ lor_count: 99 })).toEqual({});
    expect(normalizeDocs({ lor_count: -1 })).toEqual({});
    expect(normalizeDocs({ lor_count: 0 })).toEqual({ lor_count: 0 });
  });

  test("reads a JSON string as well as an object, and prose as empty", () => {
    expect(normalizeDocs('{"passport":"ready","lor_count":2}')).toEqual({
      passport: "ready",
      lor_count: 2,
    });
    expect(normalizeDocs("not json at all")).toEqual({});
    expect(normalizeDocs(null)).toEqual({});
    expect(normalizeDocs(["passport"])).toEqual({});
  });
});

describe("splitCountries", () => {
  test.each([
    ["", []],
    [null, []],
    ["Germany", ["Germany"]],
    ["Germany, Canada", ["Germany", "Canada"]],
    ["USA / UK", ["USA", "UK"]],
    ["Japan and Canada", ["Japan", "Canada"]],
    ["Germany, germany", ["Germany"]],
    ["জার্মানি", ["জার্মানি"]],
  ])("splitCountries(%o) → %o", (raw, expected) => {
    expect(splitCountries(raw)).toEqual(expected);
  });
});

// ── The known/unknown table ──────────────────────────────────────────────────

describe("the known/unknown table", () => {
  test("holds exactly the eight student-supplied inputs", () => {
    expect([...REQUIRED_INPUT_KEYS]).toEqual([
      "degree",
      "cgpa",
      "english",
      "docs",
      "research",
      "experience",
      "target_country",
      "intake",
    ]);
    // Bookmark count and the CV row are always known, so counting them would
    // floor an empty profile at Confidence 25 rather than 0.
    expect(REQUIRED_INPUT_KEYS).toHaveLength(8);
  });

  test.each([
    // ── the declared-zero versus unparseable-prose distinction ──
    ["research", { published_papers: "none" }, true],
    ["research", { published_papers: "0" }, true],
    ["research", { published_papers: "some conference work" }, false],
    ["research", {}, false],
    ["experience", { work_experience: "fresher" }, true],
    ["experience", { internships: "6 months internship" }, true],
    ["experience", { work_experience: "a fair bit" }, false],
    // ── english: status alone is enough, and so is a band alone ──
    ["english", { english_test_status: "not_started" }, true],
    ["english", { ielts_score: "7.0" }, true],
    ["english", { ielts_score: "planned" }, false],
    ["english", {}, false],
    // ── docs: one allow-listed entry ──
    ["docs", { docs: { passport: "ready" } }, true],
    ["docs", { docs: { from_a_newer_client: "ready" } }, false],
    ["docs", { docs: {} }, false],
    // ── the rest ──
    ["degree", { target_degree: "masters" }, true],
    ["degree", { target_degree: "diploma" }, false],
    ["cgpa", { cgpa: "3.4" }, true],
    ["cgpa", { cgpa: "85" }, false],
    ["target_country", { target_country: "Germany" }, true],
    ["target_country", { target_country: "   " }, false],
    ["intake", { target_intake_term: "fall", target_intake_year: 2026 }, true],
    ["intake", { target_intake_term: "fall" }, false],
    ["intake", { target_intake_year: 2026 }, false],
  ] as const)("%s is known for %o → %o", (key, row, expected) => {
    const inputs = toRoadmapInputs(row, NO_SIGNALS);
    expect(knownInputs(inputs).includes(key as InputKey)).toBe(expected);
  });

  test("an empty profile knows nothing, which is Confidence 0 rather than a floor", () => {
    const inputs = toRoadmapInputs({}, NO_SIGNALS);
    expect(knownInputs(inputs)).toEqual([]);
    expect(scoreProfile(inputs).confidence).toBe(0);
  });
});

// ── toRoadmapInputs ──────────────────────────────────────────────────────────

describe("toRoadmapInputs", () => {
  test("maps a full row onto the normalized shape", () => {
    const inputs = toRoadmapInputs(
      {
        target_degree: "masters",
        cgpa: "3.65",
        ielts_score: "IELTS 7.0 overall",
        english_test_type: "ielts",
        english_test_status: "scored",
        english_test_date: "2026-03-12T00:00:00.000Z",
        published_papers: "2 published, 1 under review",
        work_experience: "2 years 6 months",
        internships: "6 months",
        docs: { passport: "ready", lor_count: 2, nonsense: "ready" },
        target_country: " Germany ",
        preferred_countries: "Germany, Canada",
        target_intake_term: "Fall",
        target_intake_year: "2026",
        roadmap_onboarded_at: "2026-01-04T09:00:00.000Z",
      },
      { bookmarkCount: 4, cvCount: 1 },
    );

    expect(inputs).toEqual({
      degree: "master",
      cgpa: { value: 3.65, scale: 4 },
      english: { type: "ielts", band: 7, status: "scored", testDate: "2026-03-12" },
      research: { papers: 2 },
      experience: { workMonths: 30, internshipMonths: 6 },
      docs: { passport: "ready", lor_count: 2 },
      bookmarkCount: 4,
      hasCvRow: true,
      targetCountry: "Germany",
      preferredCountries: ["Germany", "Canada"],
      intake: { term: "fall", year: 2026 },
      onboardedAt: "2026-01-04T09:00:00.000Z",
    });
  });

  test("an absent column and a null column are the same thing on the read side", () => {
    const absent = toRoadmapInputs({}, NO_SIGNALS);
    const nulled = toRoadmapInputs(
      {
        target_degree: null,
        cgpa: null,
        ielts_score: null,
        english_test_type: null,
        english_test_status: null,
        english_test_date: null,
        published_papers: null,
        work_experience: null,
        internships: null,
        docs: null,
        target_country: null,
        preferred_countries: null,
        target_intake_term: null,
        target_intake_year: null,
        roadmap_onboarded_at: null,
      },
      NO_SIGNALS,
    );
    expect(nulled).toEqual(absent);
  });

  test("a Date from the driver reduces to a YYYY-MM-DD without reading a clock", () => {
    const inputs = toRoadmapInputs(
      { english_test_date: new Date("2026-03-12T18:30:00.000Z") },
      NO_SIGNALS,
    );
    expect(inputs.english.testDate).toBe("2026-03-12");
  });
});

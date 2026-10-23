import { describe, expect, it } from "vitest";
import {
  assessScholarshipDataset,
  normalizeOfficialUrl,
  scholarshipSourceRecordId,
  type RawScholarshipRecord,
} from "./scholarship-import";

const asOf = new Date("2026-10-23T00:00:00.000Z");

describe("scholarship source dataset assessment", () => {
  it("only marks records with a title, country and valid unique URL importable", () => {
    const rows: RawScholarshipRecord[] = [
      { title: "Test Award", country: "Germany", official_link: "https://uni.example/award", degree: ["Bachelor"], funding: "Fully funded" },
      { title: "No Country", country: "", official_link: "https://uni.example/other" },
      { title: "No URL", country: "Japan", official_link: "" },
    ];
    const result = assessScholarshipDataset(rows, [], asOf);
    expect(result.map((item) => item.decision)).toEqual(["importable", "needs_review", "needs_review"]);
    expect(result[0].record?.degreeLevel).toBe("bachelors");
    expect(result[0].record?.fundingType).toBe("full");
  });

  it("blocks every row in an in-source exact URL duplicate group", () => {
    const rows: RawScholarshipRecord[] = [
      { title: "Award A", country: "Italy", official_link: "https://uni.example/award?utm_source=x" },
      { title: "Award B", country: "Italy", official_link: "https://uni.example/award" },
    ];
    expect(assessScholarshipDataset(rows, [], asOf).every((item) => item.decision === "needs_review")).toBe(true);
    expect(normalizeOfficialUrl(rows[0].official_link)).toBe(normalizeOfficialUrl(rows[1].official_link));
  });

  it("marks duplicate titles and database matches for review", () => {
    const source = { title: "Award", country: "Japan", official_link: "https://uni.example/award" };
    expect(assessScholarshipDataset([source, { ...source, official_link: "https://uni.example/other" }], [], asOf)[0].reasons)
      .toContain("duplicate_title_and_country_within_source_dataset");
    const existing = [{ id: "1", title: "Award", country: "Japan", official_url: null, slug: null }];
    expect(assessScholarshipDataset([source], existing, asOf)[0].reasons)
      .toContain("title_and_country_already_in_database");
  });

  it("preserves source uncertainty and flags expired deadlines instead of publishing", () => {
    const result = assessScholarshipDataset([{
      title: "Historical Award",
      country: "Austria",
      official_link: "https://uni.example/award",
      deadline: "2025-03-15",
      telegram_date: "2025-02-20T00:29:38",
    }], [], asOf)[0];
    expect(result.decision).toBe("importable");
    expect(result.warnings).toContain("deadline_is_past_verify_new_cycle");
    expect(result.record?.deadline).toBe("2025-03-15");
  });

  it("rejects non-HTTP and private-style URLs and creates a deterministic source id", () => {
    expect(normalizeOfficialUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeOfficialUrl("https://localhost/admin")).toBeNull();
    expect(normalizeOfficialUrl("http://127.0.0.1/admin")).toBeNull();
    expect(normalizeOfficialUrl("https://[::1]/admin")).toBeNull();
    const row = { title: "Repeatable", country: "UK", official_link: "https://uni.example/award" };
    expect(scholarshipSourceRecordId(row)).toBe(scholarshipSourceRecordId(row));
  });

  it("maps multi-degree records consistently and keeps unknown fields null", () => {
    const result = assessScholarshipDataset([{
      title: "Multi Degree Award", country: "Canada", official_link: "https://uni.example/multi",
      degree: ["PhD", "Bachelor", "Masters"], funding: "Tuition waiver",
    }], [], asOf)[0];
    expect(result.record?.degreeLevel).toBe("bachelors | masters | phd");
    expect(result.record?.fundingType).toBe("tuition_only");
    expect(assessScholarshipDataset([{ title: "Missing funding", country: "Japan", official_link: "https://uni.example/x" }], [], asOf)[0].record?.fundingType).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  queries: [] as { text: string; values: unknown[] }[],
}));

vi.mock("@/utils/db", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce(
      (acc, part, index) => acc + part + (index < values.length ? `$${index + 1}` : ""),
      "",
    ).replace(/\s+/g, " ").trim();
    state.queries.push({ text, values });
    return Promise.resolve(state.rows);
  },
}));

const { GET } = await import("./route");

describe("GET /api/scholarships public visibility", () => {
  beforeEach(() => {
    state.queries = [];
    state.rows = [{
      id: "published-1",
      title: "Published Award",
      country: "Japan",
      funding_type: "full",
      deadline: "2027-02-01",
      degree_level: "bachelors",
      tags: [],
      thumbnail_url: null,
      competitiveness: null,
      is_flagship: false,
      updated_at: "2026-10-23T00:00:00.000Z",
      slug: "published-award",
      is_live: true,
      opening_note: null,
      ai_summary: "A published scholarship.",
      eligibility_summary: null,
    }];
  });

  it.each(["draft", "archived", "published"])("always limits public responses to published records even for ?status=%s", async (status) => {
    const { NextRequest } = await import("next/server");
    const response = await GET(new NextRequest(`https://example.test/api/scholarships?status=${status}`));
    const payload = await response.json() as { scholarships: Record<string, unknown>[] };

    expect(response.status).toBe(200);
    expect(payload.scholarships.map((row) => row.id)).toEqual(["published-1"]);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].text).toContain("WHERE status = 'published'");
    expect(state.queries[0].text).not.toContain("status = $1");
    expect(state.queries[0].values).toEqual([]);
  });
});

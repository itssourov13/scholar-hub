import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  queries: [] as string[],
  updates: [] as { query: string; values: unknown[] }[],
}));

vi.mock("@/utils/db", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.reduce(
      (acc, part, index) => acc + part + (index < values.length ? `$${index + 1}` : ""),
      "",
    ).replace(/\s+/g, " ").trim();
    state.queries.push(query);
    return Promise.resolve(state.rows);
  },
  sqlQuery: async (query: string, values: unknown[]) => {
    state.updates.push({ query, values });
    return [{ id: "scholarship-1", slug: "example", status: "published" }];
  },
}));

vi.mock("@/utils/api-auth", () => ({
  requireAdmin: async () => ({ userId: "admin-test" }),
}));
vi.mock("@/lib/push-content", () => ({ pushNewScholarship: vi.fn() }));
vi.mock("@/lib/revalidate-scholarships", () => ({ revalidateScholarshipPages: vi.fn() }));

const { PATCH } = await import("./route");

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/admin/scholarships/scholarship-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("PATCH /api/admin/scholarships/[id] source verification gate", () => {
  beforeEach(() => {
    state.rows = [{
      id: "scholarship-1",
      source_verification_status: "unverified",
      status: "draft",
      official_url: "https://provider.example/scholarship",
      raw_description: "Official source reviewed for test coverage.",
      source_verified_at: null,
      source_last_checked_at: null,
    }];
    state.queries = [];
    state.updates = [];
  });

  it("refuses to publish a draft whose source has not been verified", async () => {
    const response = await PATCH(request({ status: "published" }), {
      params: Promise.resolve({ id: "scholarship-1" }),
    });
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(409);
    expect(payload.error).toContain("unverified scholarship");
    expect(state.updates).toHaveLength(0);
  });

  it("does not accept a verification mark without a review timestamp", async () => {
    const response = await PATCH(request({ source_verification_status: "verified" }), {
      params: Promise.resolve({ id: "scholarship-1" }),
    });
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("source_verified_at");
    expect(state.updates).toHaveLength(0);
  });

  it("invalidates previous verification when material facts change without re-attestation", async () => {
    state.rows = [{
      id: "scholarship-1",
      status: "published",
      source_verification_status: "verified",
      official_url: "https://provider.example/scholarship",
      raw_description: "Reviewed provider evidence.",
      source_verified_at: "2026-10-24T00:00:00.000Z",
      source_last_checked_at: "2026-10-24T00:00:00.000Z",
    }];
    const response = await PATCH(request({ deadline: "20 November 2026" }), {
      params: Promise.resolve({ id: "scholarship-1" }),
    });

    expect(response.status).toBe(200);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].query).toContain("source_verification_status = $3");
    expect(state.updates[0].values).toContain("needs_update");
  });

  it("rejects unknown source-verification states", async () => {
    const response = await PATCH(request({ source_verification_status: "probably-verified" }), {
      params: Promise.resolve({ id: "scholarship-1" }),
    });

    expect(response.status).toBe(400);
    expect(state.updates).toHaveLength(0);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test, vi } from "vitest";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const { revalidateScholarshipPages } = await import("../revalidate-scholarships");
const { revalidateGuidePages } = await import("../revalidate-guides");

const CATALOGUE_PAGES = [
  "../../app/scholarships/page.tsx",
  "../../app/scholarships/[id]/page.tsx",
  "../../app/guide/page.tsx",
  "../../app/guide/[slug]/page.tsx",
] as const;

function readRel(rel: string) {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

beforeEach(() => {
  revalidatePath.mockClear();
});

describe("catalogue pages stay cached until an admin mutation", () => {
  test("none of the public catalogue pages use hourly ISR", () => {
    for (const rel of CATALOGUE_PAGES) {
      const src = readRel(rel);
      expect(src, rel).not.toMatch(/export const revalidate = 3600/);
      expect(src, rel).toMatch(/export const revalidate = false/);
    }
  });

  test("next/image does not go through Vercel Image Optimization", () => {
    expect(readRel("../../../next.config.ts")).toMatch(/unoptimized:\s*true/);
  });
});

describe("revalidateScholarshipPages", () => {
  test("busts the listing, home, and both slug and UUID detail paths", () => {
    revalidateScholarshipPages({ slug: "chevening", id: "uuid-1" });
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual([
      "/scholarships",
      "/",
      "/scholarships/chevening",
      "/scholarships/uuid-1",
    ]);
  });

  test("does not emit a duplicate path when slug is the only identifier", () => {
    revalidateScholarshipPages({ slug: "daad" });
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual([
      "/scholarships",
      "/",
      "/scholarships/daad",
    ]);
  });
});

describe("revalidateGuidePages", () => {
  test("busts the index, home, and the slug detail path", () => {
    revalidateGuidePages("ielts-waiver");
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual([
      "/guide",
      "/",
      "/guide/ielts-waiver",
    ]);
  });
});

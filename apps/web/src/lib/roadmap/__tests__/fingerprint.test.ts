import fc from "fast-check";
import { describe, expect, test } from "vitest";

import { fingerprint, fingerprintFor, stableStringify } from "../fingerprint";
import { ENGINE_VERSION } from "../types";
import { arbRoadmapInputs, shuffleKeys } from "./arbitraries";

// ── Property 9 ───────────────────────────────────────────────────────────────

// Feature: roadmap, Property 9: For any RoadmapInputs, deeply shuffling object key
// order leaves the fingerprint unchanged, and changing ENGINE_VERSION changes it.
test("the fingerprint depends on values and the engine version, nothing else", () => {
  fc.assert(
    fc.property(arbRoadmapInputs(), fc.integer({ min: 2, max: 50 }), (inputs, otherVersion) => {
      const shuffled = shuffleKeys(inputs);

      // Insertion order is not data: a route that builds the inputs field by field
      // in a different order must not invalidate every stored narration.
      expect(fingerprint(shuffled)).toBe(fingerprint(inputs));
      expect(fingerprint(inputs)).toMatch(/^[0-9a-f]{64}$/);

      // The version is data: a bump invalidates every cached narration on purpose.
      expect(fingerprintFor(ENGINE_VERSION, inputs)).toBe(fingerprint(inputs));
      expect(fingerprintFor(ENGINE_VERSION + otherVersion, inputs)).not.toBe(fingerprint(inputs));
    }),
    { numRuns: 100 },
  );
});

// ── stableStringify ──────────────────────────────────────────────────────────

describe("stableStringify", () => {
  test("sorts object keys and keeps array order", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
    // A list's order is data.
    expect(stableStringify(["b", "a"])).toBe('["b","a"]');
    expect(stableStringify(["b", "a"])).not.toBe(stableStringify(["a", "b"]));
  });

  test("sorts recursively", () => {
    expect(stableStringify({ outer: { z: [{ b: 1, a: 2 }], y: 3 } })).toBe(
      '{"outer":{"y":3,"z":[{"a":2,"b":1}]}}',
    );
  });

  test("treats absent and undefined alike, so an optional field cannot split the cache", () => {
    expect(stableStringify({ lor_count: undefined })).toBe(stableStringify({}));
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });

  test("serialises null and non-finite numbers as null", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(Number.NaN)).toBe("null");
    expect(stableStringify(Number.POSITIVE_INFINITY)).toBe("null");
  });

  test("a changed value changes the string, and therefore the hash", () => {
    const a = { cgpa: { value: 3.4, scale: 4 } };
    const b = { cgpa: { value: 3.5, scale: 4 } };
    expect(stableStringify(a)).not.toBe(stableStringify(b));
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Engine purity, read off the source text.
 *
 * Property 6 proves the same thing behaviourally against `buildRoadmap`, but it
 * arrives with task 3, and purity is the precondition for every other assertion
 * about this engine — a scorer that can read the clock is a scorer whose output
 * cannot be pinned by a fixture. So it is checked here, cheaply, per file.
 *
 * `node:crypto` in `fingerprint.ts` is the one allowed import: hashing is
 * computation, not I/O.
 */

const ENGINE_FILES = [
  "types.ts",
  "inputs.ts",
  "scoring.ts",
  "fingerprint.ts",
  "evidence.ts",
  "catalog.ts",
  "country-rules.ts",
  "graph.ts",
] as const;

const sourceOf = (file: string) =>
  readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), "utf8");

/** Comments say things like "no `Date.now()`", so the prohibitions are asserted
 *  against executable text only. */
const codeOf = (file: string) =>
  sourceOf(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\/.*$/gm, "");

describe.each(ENGINE_FILES)("%s is pure", (file) => {
  const code = codeOf(file);

  test("imports no database module", () => {
    expect(code).not.toMatch(/from\s+["'][^"']*utils\/db["']/);
    expect(code).not.toMatch(/\bsqlQuery\b/);
    expect(code).not.toMatch(/@neondatabase/);
  });

  test("makes no network call", () => {
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/\bfetchCompletion\b/);
  });

  test("reads no clock", () => {
    expect(code).not.toMatch(/Date\.now\s*\(/);
    expect(code).not.toMatch(/performance\.now\s*\(/);
    // `new Date(x)` is arithmetic on a value someone else supplied; `new Date()`
    // is a clock read.
    expect(code).not.toMatch(/new\s+Date\s*\(\s*\)/);
  });

  test("touches no environment or filesystem", () => {
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/node:fs/);
    expect(code).not.toMatch(/\bMath\.random\s*\(/);
  });

  test("imports nothing outside the engine, bar node:crypto in fingerprint.ts", () => {
    const specifiers = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    for (const specifier of specifiers) {
      if (specifier === "node:crypto") {
        expect(file).toBe("fingerprint.ts");
        continue;
      }
      expect(specifier, `${file} imports ${specifier}`).toMatch(/^\.\//);
    }
  });
});

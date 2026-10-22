import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Migration 026 runs once, against a live table that every request touches, so
 * the cheapest useful test is to read it as text and assert the shape. These
 * catch the class of mistake that actually matters here: a rewrite-forcing
 * DEFAULT, a missing IF NOT EXISTS, or a schema statement that escaped the
 * transaction and its timeouts.
 */

const SQL_PATH = fileURLToPath(new URL("../026_ai_roadmap.sql", import.meta.url));
const RAW = readFileSync(SQL_PATH, "utf8");

/** The header comment names DROP and ALTER TYPE to say they are absent, so the
 *  prohibitions are asserted against executable text only. */
const SQL = RAW.replace(/--.*$/gm, "");

const PROFILE_COLUMNS = [
  "target_country",
  "target_intake_term",
  "target_intake_year",
  "english_test_type",
  "english_test_status",
  "english_test_date",
  "docs",
  "roadmap_onboarded_at",
];

/** Every `ALTER TABLE public.profiles ...` statement, one per line as written. */
const profileAlters = SQL.split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /^ALTER TABLE public\.profiles\b/i.test(line));

describe("026_ai_roadmap.sql is additive only", () => {
  test("no DROP, RENAME, ALTER TYPE or ADD CONSTRAINT", () => {
    expect(SQL).not.toMatch(/\bDROP\b(?!\s+CASCADE)/i);
    expect(SQL).not.toMatch(/\bRENAME\b/i);
    expect(SQL).not.toMatch(/\bALTER\s+TYPE\b/i);
    expect(SQL).not.toMatch(/\bADD\s+CONSTRAINT\b/i);
  });

  test("ON DELETE CASCADE is the only DROP-adjacent phrase, and it is on new tables only", () => {
    // Sanity check on the assertion above: the FKs are declared inline on the
    // two new tables, never bolted onto profiles.
    expect(SQL.match(/ON DELETE CASCADE/g)).toHaveLength(2);
    for (const statement of profileAlters) {
      expect(statement).not.toMatch(/REFERENCES/i);
    }
  });

  test("every profiles ADD COLUMN is IF NOT EXISTS, with no NOT NULL and no DEFAULT", () => {
    expect(profileAlters).toHaveLength(PROFILE_COLUMNS.length);
    for (const statement of profileAlters) {
      expect(statement).toMatch(/ADD COLUMN IF NOT EXISTS/i);
      expect(statement).not.toMatch(/\bNOT NULL\b/i);
      expect(statement).not.toMatch(/\bDEFAULT\b/i);
    }
  });

  test("all eight roadmap columns are added, and nothing else is", () => {
    const added = profileAlters.map((statement) => {
      const match = /ADD COLUMN IF NOT EXISTS\s+(\w+)/i.exec(statement);
      return match ? match[1] : "";
    });
    expect(added).toEqual(PROFILE_COLUMNS);
  });
});

describe("026_ai_roadmap.sql structure", () => {
  test("exactly two CREATE TABLE statements", () => {
    expect(SQL.match(/CREATE TABLE/gi)).toHaveLength(2);
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.roadmaps/i);
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.milestone_progress/i);
  });

  test("BEGIN precedes both SET LOCAL lines, which precede the first schema statement", () => {
    const begin = SQL.indexOf("BEGIN;");
    const lockTimeout = SQL.search(/SET LOCAL\s+lock_timeout/i);
    const statementTimeout = SQL.search(/SET LOCAL\s+statement_timeout/i);
    const firstSchemaStatement = SQL.search(/\b(ALTER TABLE|CREATE TABLE|CREATE INDEX)\b/i);

    expect(begin).toBeGreaterThanOrEqual(0);
    expect(lockTimeout).toBeGreaterThan(begin);
    expect(statementTimeout).toBeGreaterThan(begin);
    expect(firstSchemaStatement).toBeGreaterThan(lockTimeout);
    expect(firstSchemaStatement).toBeGreaterThan(statementTimeout);
    expect(SQL.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  test("the timeouts are the ones the design specifies", () => {
    expect(SQL).toMatch(/SET LOCAL\s+lock_timeout\s*=\s*'3s'/i);
    expect(SQL).toMatch(/SET LOCAL\s+statement_timeout\s*=\s*'30s'/i);
  });

  test("milestone_progress is keyed by (user_id, milestone_key)", () => {
    expect(SQL).toMatch(/PRIMARY KEY \(user_id, milestone_key\)/);
  });

  test("roadmaps.readiness is nullable — NULL is not 0", () => {
    expect(SQL).toMatch(/readiness\s+INTEGER,/);
    expect(SQL).not.toMatch(/readiness\s+INTEGER\s+NOT NULL/i);
  });

  test("the narration index is partial", () => {
    expect(SQL).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_roadmaps_narration_unfinished[\s\S]*?WHERE narration_status <> 'ready'/,
    );
  });
});

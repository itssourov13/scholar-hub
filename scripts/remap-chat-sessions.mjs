/**
 * remap-chat-sessions.mjs
 *
 * Re-maps orphaned chat_sessions in Neon (user_id IS NULL) to their correct
 * Clerk user IDs by looking up the original Supabase user_id → email → Clerk ID.
 *
 * Uses Supabase REST API (no direct DB connection needed).
 * Safe to run multiple times — only updates sessions still null.
 *
 * Usage (from repo root):
 *   node scripts/remap-chat-sessions.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load apps/web/.env.local ───────────────────────────────────────────────────
const envPath = resolve(__dirname, "../apps/web/.env.local");
const envVars = readFileSync(envPath, "utf-8")
  .split("\n")
  .reduce((acc, line) => {
    const clean = line.replace(/#.*$/, "").trim();
    const idx = clean.indexOf("=");
    if (idx > 0) {
      const key = clean.slice(0, idx).trim();
      const val = clean.slice(idx + 1).trim();
      if (key && val) acc[key] = val;
    }
    return acc;
  }, {});

const env = (k) => process.env[k] ?? envVars[k] ?? "";

const SUPABASE_URL         = env("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const DATABASE_URL         = env("DATABASE_URL");
const CLERK_SECRET_KEY     = env("CLERK_SECRET_KEY");
const CLERK_API            = "https://api.clerk.com/v1";

if (!SUPABASE_URL)         throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!SUPABASE_SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
if (!DATABASE_URL)         throw new Error("DATABASE_URL is not set");
if (!CLERK_SECRET_KEY)     throw new Error("CLERK_SECRET_KEY is not set");

const neonSql = neon(DATABASE_URL);

// ── Supabase REST helpers ──────────────────────────────────────────────────────
const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── 1. Fetch all Clerk users: email → Clerk ID ────────────────────────────────
console.log("Fetching Clerk users...");
const emailToClerkId = new Map();
let offset = 0;
while (true) {
  const res  = await fetch(`${CLERK_API}/users?limit=100&offset=${offset}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  const page = await res.json();
  if (!Array.isArray(page) || page.length === 0) break;
  for (const u of page) {
    const email = u.email_addresses?.[0]?.email_address;
    if (email) emailToClerkId.set(email.toLowerCase(), u.id);
  }
  if (page.length < 100) break;
  offset += 100;
}
console.log(`  → ${emailToClerkId.size} Clerk users loaded`);

// ── 2. Fetch Supabase auth users: Supabase UUID → email ───────────────────────
console.log("Fetching Supabase auth users...");
const supabaseIdToClerkId = new Map();
let authPage = 1;
while (true) {
  const data = await sbGet(`/auth/v1/admin/users?page=${authPage}&per_page=1000`);
  const users = data.users ?? (Array.isArray(data) ? data : []);
  if (users.length === 0) break;
  for (const u of users) {
    const clerkId = emailToClerkId.get(u.email?.toLowerCase());
    if (clerkId) supabaseIdToClerkId.set(u.id, clerkId);
  }
  if (users.length < 1000) break;
  authPage++;
}
console.log(`  → ${supabaseIdToClerkId.size} Supabase → Clerk ID mappings built`);

// ── 3. Fetch Supabase chat_sessions with a real user_id ───────────────────────
console.log("\nFetching Supabase chat sessions with a user_id...");
const sbSessions = await sbGet(
  `/rest/v1/chat_sessions?user_id=not.is.null&select=id,user_id`
);
console.log(`  → ${sbSessions.length} sessions to remap`);

// ── 4. UPDATE Neon sessions that are still unmapped ───────────────────────────
console.log("\nUpdating Neon chat_sessions...");
let updated = 0, skipped = 0, notFound = 0;

for (const s of sbSessions) {
  const clerkId = supabaseIdToClerkId.get(s.user_id);
  if (!clerkId) {
    skipped++;
    continue;
  }

  const result = await neonSql`
    UPDATE public.chat_sessions
    SET user_id = ${clerkId}
    WHERE id = ${s.id} AND user_id IS NULL
    RETURNING id
  `;

  if (result.length > 0) {
    updated++;
  } else {
    notFound++;
  }
}

console.log(`\nDone!`);
console.log(`  ✓ Updated  : ${updated} sessions`);
console.log(`  ~ Skipped  : ${skipped} (user not found in Clerk)`);
console.log(`  - No change: ${notFound} (already mapped or missing in Neon)`);

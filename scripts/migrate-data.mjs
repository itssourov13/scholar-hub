/**
 * migrate-data.mjs
 *
 * Migrates user-dependent data from Supabase → Neon,
 * remapping old Supabase UUIDs to new Clerk user IDs via email.
 *
 * Run AFTER:
 *   1. Schema is applied on Neon (018_neon_migration.sql)
 *   2. Users are imported to Clerk (migrate-users.mjs)
 *   3. Group A tables are restored (scholarships, guides, etc.)
 *
 * Usage:
 *   node scripts/migrate-data.mjs
 *
 * Required env vars:
 *   SUPABASE_DB_URL   - Supabase direct connection string
 *   DATABASE_URL      - Neon connection string
 *   CLERK_SECRET_KEY  - Clerk backend API key
 */

import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_API = "https://api.clerk.com/v1";

if (!SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");
if (!CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY is not set");

const supabase = postgres(SUPABASE_DB_URL, { ssl: "require" });
const neonSql = neon(DATABASE_URL);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAllClerkUsers() {
  console.log("Fetching all users from Clerk...");
  const users = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(
      `${CLERK_API}/users?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } }
    );
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    users.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }

  // Build email → clerk_id map
  const map = new Map();
  for (const u of users) {
    const email = u.email_addresses?.[0]?.email_address;
    if (email) map.set(email.toLowerCase(), u.id);
  }
  console.log(`  → ${map.size} Clerk users indexed by email\n`);
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const emailToClerkId = await fetchAllClerkUsers();

// ── 1. Migrate profile DATA fields ───────────────────────────────────────────
// (profiles rows already exist from migrate-users.mjs — just fill in data)
console.log("1. Migrating profile data...");

const sbProfiles = await supabase`
  SELECT p.*, u.email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
`;

let profilesUpdated = 0;
for (const p of sbProfiles) {
  const clerkId = emailToClerkId.get(p.email?.toLowerCase());
  if (!clerkId) { console.warn(`  ✗ No Clerk user for ${p.email}`); continue; }

  await neonSql`
    UPDATE public.profiles SET
      cgpa                = ${p.cgpa ?? null},
      work_experience     = ${p.work_experience ?? null},
      target_degree       = ${p.target_degree ?? null},
      preferred_countries = ${p.preferred_countries ?? null},
      goals_notes         = ${p.goals_notes ?? null},
      bsc_major           = ${p.bsc_major ?? null},
      university          = ${p.university ?? null},
      graduation_year     = ${p.graduation_year ?? null},
      research_interests  = ${p.research_interests ?? null},
      published_papers    = ${p.published_papers ?? null},
      ielts_score         = ${p.ielts_score ?? null},
      gre_gmat_score      = ${p.gre_gmat_score ?? null},
      internships         = ${p.internships ?? null},
      portfolio_url       = ${p.portfolio_url ?? null},
      role                = ${p.role ?? 'student'}
    WHERE id = ${clerkId}
  `;
  profilesUpdated++;
}
console.log(`  ✓ Updated ${profilesUpdated} profiles\n`);

// ── 2. Build old Supabase UUID → Clerk ID map ────────────────────────────────
// (needed to remap FKs in bookmarks, tasks, chat_sessions)
const sbUsers = await supabase`
  SELECT u.id AS supabase_id, u.email
  FROM auth.users u
`;

const supabaseIdToClerkId = new Map();
for (const u of sbUsers) {
  const clerkId = emailToClerkId.get(u.email?.toLowerCase());
  if (clerkId) supabaseIdToClerkId.set(u.supabase_id, clerkId);
}
console.log(`ID map built: ${supabaseIdToClerkId.size} users\n`);

// ── 3. Migrate user_bookmarks ─────────────────────────────────────────────────
console.log("3. Migrating user_bookmarks...");
const sbBookmarks = await supabase`SELECT * FROM public.user_bookmarks`;
let bookmarksOk = 0;
for (const b of sbBookmarks) {
  const clerkId = supabaseIdToClerkId.get(b.user_id);
  if (!clerkId) continue;
  await neonSql`
    INSERT INTO public.user_bookmarks (id, user_id, scholarship_id, created_at)
    VALUES (gen_random_uuid(), ${clerkId}, ${b.scholarship_id}, ${b.created_at})
    ON CONFLICT DO NOTHING
  `;
  bookmarksOk++;
}
console.log(`  ✓ ${bookmarksOk} bookmarks\n`);

// ── 4. Migrate user_tasks ─────────────────────────────────────────────────────
console.log("4. Migrating user_tasks...");
const sbTasks = await supabase`SELECT * FROM public.user_tasks`;
let tasksOk = 0;
for (const t of sbTasks) {
  const clerkId = supabaseIdToClerkId.get(t.user_id);
  if (!clerkId) continue;
  await neonSql`
    INSERT INTO public.user_tasks (id, user_id, title, due_date, status, created_at, updated_at)
    VALUES (coalesce(${t.id ?? null}::uuid, gen_random_uuid()), ${clerkId}, ${t.title}, ${t.due_date ?? null}, ${t.status}, ${t.created_at}, ${t.updated_at})
    ON CONFLICT DO NOTHING
  `;
  tasksOk++;
}
console.log(`  ✓ ${tasksOk} tasks\n`);

// ── 5. Migrate chat_sessions + chat_messages ──────────────────────────────────
console.log("5. Migrating chat sessions...");
const sbSessions = await supabase`SELECT * FROM public.chat_sessions`;
let sessionsOk = 0;
for (const s of sbSessions) {
  const clerkId = s.user_id ? supabaseIdToClerkId.get(s.user_id) : null;
  await neonSql`
    INSERT INTO public.chat_sessions (id, user_id, anon_key, title, created_at, updated_at)
    VALUES (${s.id}, ${clerkId ?? null}, ${s.anon_key ?? null}, ${s.title}, ${s.created_at}, ${s.updated_at})
    ON CONFLICT DO NOTHING
  `;
  sessionsOk++;
}
console.log(`  ✓ ${sessionsOk} sessions\n`);

console.log("6. Migrating chat messages...");
const sbMessages = await supabase`SELECT * FROM public.chat_messages`;
let messagesOk = 0;
for (const m of sbMessages) {
  await neonSql`
    INSERT INTO public.chat_messages (id, session_id, role, content, created_at)
    VALUES (${m.id}, ${m.session_id}, ${m.role}, ${m.content}, ${m.created_at})
    ON CONFLICT DO NOTHING
  `;
  messagesOk++;
}
console.log(`  ✓ ${messagesOk} messages\n`);

await supabase.end();
console.log("✅ Data migration complete!");

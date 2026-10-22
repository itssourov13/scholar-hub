/**
 * migrate-content.mjs
 *
 * Migrates content tables from Supabase → Neon using Node.js.
 * Handles type mismatches (text[] → jsonb for tags) and schema differences.
 *
 * Tables migrated:
 *   - scholarships  (tags: text[] → jsonb)
 *   - ScholarshipDoc (vector embeddings)
 *   - guides        (tags: text[] → jsonb)
 *   - prompt_cache
 *
 * Usage:
 *   node scripts/migrate-content.mjs
 *
 * Required env vars:
 *   SUPABASE_DB_URL   - Supabase direct connection string
 *   DATABASE_URL      - Neon direct connection string (NOT pooler)
 */

import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sb = postgres(SUPABASE_DB_URL, { ssl: "require" });
const neonSql = neon(DATABASE_URL);

// Convert Postgres text[] to a proper JSON array
// Input:  {Australia,"Partial Funding",Undergraduate}
// Output: ["Australia","Partial Funding","Undergraduate"]
function pgArrayToJson(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val; // already parsed by driver
  if (typeof val === "string") {
    // Strip outer braces
    const inner = val.replace(/^\{/, "").replace(/\}$/, "");
    if (!inner) return [];
    // Split on commas not inside quotes
    const items = [];
    let current = "";
    let inQuotes = false;
    for (const ch of inner) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { items.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    if (current.trim()) items.push(current.trim());
    return items;
  }
  return [];
}

// ── 1. scholarships ───────────────────────────────────────────────────────────
console.log("1. Migrating scholarships...");

const scholarships = await sb`SELECT * FROM public.scholarships`;
let ok = 0;
for (const s of scholarships) {
  const tags = JSON.stringify(pgArrayToJson(s.tags));
  await neonSql`
    INSERT INTO public.scholarships (
      id, created_by, title, country, degree_level, funding_type,
      deadline, official_url, raw_description, status, thumbnail_url,
      is_flagship, ai_summary, eligibility_summary, competitiveness,
      tips, tags, thumbnail_prompt, created_at, updated_at
    ) VALUES (
      ${s.id}, ${s.created_by ?? null}, ${s.title}, ${s.country},
      ${s.degree_level ?? null}, ${s.funding_type ?? null},
      ${s.deadline ?? null}, ${s.official_url ?? null},
      ${s.raw_description ?? null}, ${s.status}, ${s.thumbnail_url ?? null},
      ${s.is_flagship ?? false}, ${s.ai_summary ?? null},
      ${s.eligibility_summary ?? null}, ${s.competitiveness ?? null},
      ${s.tips ?? null}, ${tags}::jsonb,
      ${s.thumbnail_prompt ?? null}, ${s.created_at}, ${s.updated_at}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  ok++;
}
console.log(`  ✓ ${ok} scholarships\n`);

// ── 2. ScholarshipDoc (embeddings) ────────────────────────────────────────────
console.log("2. Migrating ScholarshipDoc (embeddings)...");
const docs = await sb`SELECT * FROM public."ScholarshipDoc"`;
ok = 0;
for (const d of docs) {
  // embedding comes as a string like "[0.1,0.2,...]" or an array
  const embedding = Array.isArray(d.embedding)
    ? `[${d.embedding.join(",")}]`
    : d.embedding;

  await neonSql`
    INSERT INTO public."ScholarshipDoc" (id, scholarship_id, content, embedding, metadata, created_at)
    VALUES (
      ${d.id}, ${d.scholarship_id}, ${d.content},
      ${embedding}::vector,
      ${JSON.stringify(d.metadata ?? {})}::jsonb,
      ${d.created_at}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  ok++;
}
console.log(`  ✓ ${ok} docs\n`);

// ── 3. guides ─────────────────────────────────────────────────────────────────
console.log("3. Migrating guides...");
const guides = await sb`SELECT * FROM public.guides`;
ok = 0;
for (const g of guides) {
  const tags = JSON.stringify(pgArrayToJson(g.tags));
  const faqs = typeof g.faqs === "string" ? g.faqs : JSON.stringify(g.faqs ?? []);
  await neonSql`
    INSERT INTO public.guides (
      id, slug, title, description, category, tags, intro,
      content, faqs, status, cover_image_url, published_at,
      created_at, updated_at
    ) VALUES (
      ${g.id}, ${g.slug}, ${g.title}, ${g.description ?? ""},
      ${g.category ?? "Scholarships"}, ${tags}::jsonb, ${g.intro ?? ""},
      ${g.content ?? null}, ${faqs}::jsonb, ${g.status},
      ${g.cover_image_url ?? null}, ${g.published_at ?? null},
      ${g.created_at}, ${g.updated_at}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  ok++;
}
console.log(`  ✓ ${ok} guides\n`);

// ── 4. prompt_cache ───────────────────────────────────────────────────────────
console.log("4. Migrating prompt_cache...");
const cache = await sb`SELECT * FROM public.prompt_cache`;
ok = 0;
for (const c of cache) {
  await neonSql`
    INSERT INTO public.prompt_cache (
      id, cache_key, model, user_message, response,
      hit_count, last_hit_at, expires_at, created_at
    ) VALUES (
      ${c.id}, ${c.cache_key}, ${c.model}, ${c.user_message}, ${c.response},
      ${c.hit_count ?? 0}, ${c.last_hit_at ?? null}, ${c.expires_at}, ${c.created_at}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  ok++;
}
console.log(`  ✓ ${ok} prompt_cache rows\n`);

await sb.end();
console.log("✅ Content migration complete!");

/**
 * migrate-users.mjs
 *
 * Migrates users from a Supabase CSV export → Clerk + Neon profiles table.
 *
 * Usage:
 *   # Step 1 — import users (run before deployment, NO emails sent)
 *   node scripts/migrate-users.mjs ./users.csv
 *
 *   # Step 2 — send password reset emails (run AFTER deployment is live)
 *   node scripts/migrate-users.mjs ./users.csv --send-emails
 */

import fs from "fs";
import { parse } from "csv-parse/sync";
import { neon } from "@neondatabase/serverless";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const CLERK_API = "https://api.clerk.com/v1";

if (!CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY is not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = neon(DATABASE_URL);

async function clerkRequest(method, path, body) {
  const res = await fetch(CLERK_API + path, {
    method,
    headers: {
      Authorization: "Bearer " + CLERK_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) throw new Error(text);
  return json;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseName(row) {
  const fullName = (row.full_name || "").trim();
  const parts = fullName.split(" ");
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
}

// ── Fetch ALL Clerk users up front so we have accurate IDs ────────────────────
console.log("Loading all users from Clerk...");
const emailToClerkUser = new Map();
let offset = 0;
while (true) {
  const page = await clerkRequest("GET", "/users?limit=100&offset=" + offset);
  if (!Array.isArray(page) || page.length === 0) break;
  for (const u of page) {
    for (const ea of (u.email_addresses || [])) {
      emailToClerkUser.set(ea.email_address.toLowerCase(), u);
    }
  }
  if (page.length < 100) break;
  offset += 100;
  await sleep(200);
}
console.log("  → " + emailToClerkUser.size + " Clerk users loaded\n");

// ── Main ──────────────────────────────────────────────────────────────────────
const csvPath = process.argv[2];
const sendEmails = process.argv.includes("--send-emails");

if (!csvPath) {
  console.error("Usage: node scripts/migrate-users.mjs <path-to-users.csv> [--send-emails]");
  process.exit(1);
}

console.log(sendEmails
  ? "📧 --send-emails flag set: password reset emails WILL be sent\n"
  : "ℹ️  No --send-emails flag: users imported but NOT emailed.\n");

const rows = parse(fs.readFileSync(csvPath, "utf8"), { columns: true, skip_empty_lines: true });
console.log("Found " + rows.length + " users in CSV\n");

let created = 0, skipped = 0, emailSent = 0, emailSkipped = 0, failed = 0;

for (const row of rows) {
  const email = (row.email || "").trim().toLowerCase();
  if (!email) { skipped++; continue; }

  const { firstName, lastName } = parseName(row);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  try {
    let clerkId;
    let existingUser = emailToClerkUser.get(email);

    if (existingUser) {
      // User already in Clerk
      clerkId = existingUser.id;
      skipped++;
    } else {
      // Create new user
      const u = await clerkRequest("POST", "/users", {
        email_address: [email],
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        skip_password_requirement: true,
      });
      clerkId = u.id;
      created++;
      await sleep(200);
    }

    // Upsert profile in Neon
    await sql`
      INSERT INTO profiles (id, full_name, role)
      VALUES (${clerkId}, ${fullName || null}, 'student')
      ON CONFLICT (id) DO NOTHING
    `;

    if (sendEmails) {
      try {
        // Set a temp password to enable the password strategy, then send reset email
        const tempPwd = "Bp!" + Math.random().toString(36).slice(2, 10) + "X9";
        await clerkRequest("PATCH", "/users/" + clerkId, {
          password: tempPwd,
          skip_password_checks: true,
        });
        await sleep(300);
        await clerkRequest("POST", "/users/" + clerkId + "/send_reset_password_email", {});
        console.log("📧 " + email);
        emailSent++;
      } catch (e) {
        const msg = (e.message || "").slice(0, 100);
        console.warn("⚠️  " + email + " — " + msg);
        emailSkipped++;
      }
      await sleep(500); // conservative delay to avoid rate limits
    } else {
      console.log("✓ " + email + " → " + clerkId);
      await sleep(100);
    }

  } catch (err) {
    console.error("✗ " + email + ": " + (err.message || String(err)).slice(0, 120));
    failed++;
  }
}

console.log("\nDone!");
console.log("  Created   : " + created);
console.log("  Skipped   : " + skipped + " (already in Clerk)");
if (sendEmails) {
  console.log("  📧 Sent   : " + emailSent);
  console.log("  ⚠️  Skipped: " + emailSkipped + " (OAuth-only or rate limited)");
}
console.log("  Failed    : " + failed);

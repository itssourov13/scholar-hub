import { sql } from "@/utils/db";
import { broadcastLocalizedPush, isPushConfigured } from "@/utils/push";

/**
 * "New content" pushes, fired when an admin publishes.
 *
 * The send is claimed with a conditional UPDATE on `push_sent_at`, so the
 * fan-out happens exactly once no matter how many times the row is PATCHed
 * afterwards (admins routinely re-save to tweak copy or thumbnails).
 *
 * Copy mirrors the `push.*` keys in the mobile translations file — keep the two
 * in sync if either changes.
 */

export async function pushNewScholarship(id: string): Promise<void> {
  if (!isPushConfigured()) return;

  try {
    const rows = await sql`
      UPDATE scholarships SET push_sent_at = NOW()
      WHERE id = ${id} AND push_sent_at IS NULL AND status = 'published'
      RETURNING id, title, thumbnail_url
    `;
    const row = rows[0];
    if (!row) return;

    const title = row.title as string;
    const url = `/scholarship/${row.id}`;
    const imageUrl = (row.thumbnail_url as string | null) ?? null;
    const result = await broadcastLocalizedPush({
      en: { title: "New scholarship 🎓", body: title, url, imageUrl },
      bn: { title: "নতুন স্কলারশিপ 🎓", body: title, url, imageUrl },
    });
    console.log(`[push] new scholarship ${row.id}:`, result);
  } catch (err) {
    console.error("[push] pushNewScholarship failed:", err);
  }
}

export async function pushNewGuide(id: string): Promise<void> {
  if (!isPushConfigured()) return;

  try {
    const rows = await sql`
      UPDATE guides SET push_sent_at = NOW()
      WHERE id = ${id} AND push_sent_at IS NULL AND status = 'published'
      RETURNING slug, title, cover_image_url
    `;
    const row = rows[0];
    if (!row) return;

    const title = row.title as string;
    const url = `/guide/${row.slug as string}`;
    const imageUrl = (row.cover_image_url as string | null) ?? null;
    const result = await broadcastLocalizedPush({
      en: { title: "New guide 📖", body: title, url, imageUrl },
      bn: { title: "নতুন গাইড 📖", body: title, url, imageUrl },
    });
    console.log(`[push] new guide ${row.slug}:`, result);
  } catch (err) {
    console.error("[push] pushNewGuide failed:", err);
  }
}

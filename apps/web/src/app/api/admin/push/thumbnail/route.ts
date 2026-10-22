import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/api-auth";
import { uploadToR2, getPublicUrl } from "@/utils/r2";
import sharp from "sharp";

/** Same cap as guide covers — the file is compressed to WebP before it lands on R2. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Upload a one-off announcement thumbnail to R2. The returned https URL is
 * what FCM fetches as the expandable big-picture on Android — same path as
 * scholarship/guide pushes (android.notification.image).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image is larger than 4 MB" }, { status: 400 });
  }

  let compressed: Buffer;
  try {
    compressed = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Could not read that image" }, { status: 400 });
  }

  const key = `push-announcements/${Date.now()}-${randomUUID().slice(0, 8)}/thumbnail.webp`;

  try {
    await uploadToR2(key, compressed, "image/webp", "public, max-age=31536000, immutable");
  } catch (err) {
    console.error("[push] thumbnail upload failed:", err);
    return NextResponse.json({ error: "Could not store thumbnail" }, { status: 500 });
  }

  const imageUrl = `${getPublicUrl(key)}?v=${Date.now()}`;
  return NextResponse.json({ imageUrl });
}

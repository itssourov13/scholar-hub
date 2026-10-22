// Generates small, optimised icon variants from the large source logo so we
// don't ship a 542 KB PNG as the favicon on every page load.
// Run: node scripts/gen-favicons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const source = path.join(publicDir, "logo.png");

const targets = [
  { name: "icon-32.png", size: 32 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of targets) {
  const out = path.join(publicDir, name);
  await sharp(source)
    .resize(size, size, { fit: "contain", background: { r: 243, g: 239, b: 231, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${name} (${size}x${size})`);
}

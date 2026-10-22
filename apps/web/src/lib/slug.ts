/**
 * Generates a URL-safe slug for a scholarship.
 * Format: {title}-{country} normalised to lowercase kebab-case.
 *
 * Examples:
 *   generateScholarshipSlug("Fulbright Scholarship", "USA")
 *   → "fulbright-scholarship-usa"
 *
 *   generateScholarshipSlug("DAAD's Research Grant (2025)", "Germany")
 *   → "daads-research-grant-2025-germany"
 */
export function generateScholarshipSlug(title: string, country: string): string {
  return `${title} ${country}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (é → e)
    .replace(/[^a-z0-9\s]/g, "")    // remove non-alphanumeric chars
    .trim()
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse consecutive hyphens
    .replace(/^-|-$/g, "")           // trim leading/trailing hyphens
    .slice(0, 80);                   // max 80 chars for safe URLs
}

/**
 * Appends a numeric suffix to make a slug unique.
 * Used when a generated slug already exists in the database.
 *
 * generateUniqueSlug("fulbright-usa", existingSlugs)
 * → "fulbright-usa-2"  (if "fulbright-usa" is taken)
 */
export function makeSlugUnique(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let counter = 2;
  while (existing.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

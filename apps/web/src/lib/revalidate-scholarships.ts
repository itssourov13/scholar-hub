import { revalidatePath } from "next/cache";

/**
 * On-demand ISR for scholarship surfaces. Time-based `revalidate = 3600` was
 * regenerating 300+ detail pages every hour and burning Vercel Hobby ISR
 * writes; these paths now stay cached until an admin mutation calls this.
 */
export function revalidateScholarshipPages(opts?: {
  slug?: string | null;
  id?: string | null;
}) {
  revalidatePath("/scholarships");
  revalidatePath("/");
  const slug = opts?.slug ?? undefined;
  const id = opts?.id ?? undefined;
  if (slug) revalidatePath(`/scholarships/${slug}`);
  if (id && id !== slug) revalidatePath(`/scholarships/${id}`);
}

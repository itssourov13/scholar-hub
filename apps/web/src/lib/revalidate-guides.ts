import { revalidatePath } from "next/cache";

/** Bust cached guide HTML. Pages use on-demand ISR (`revalidate = false`). */
export function revalidateGuidePages(slug?: string) {
  revalidatePath("/guide");
  revalidatePath("/");
  if (slug) revalidatePath(`/guide/${slug}`);
}

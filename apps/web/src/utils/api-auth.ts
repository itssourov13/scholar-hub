import { auth } from "@clerk/nextjs/server";
import { sql } from "@/utils/db";

/**
 * Returns the current Clerk userId, or null if not signed in.
 * Use in any API route that needs an authenticated user.
 */
export async function getUser(): Promise<{ userId: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return { userId };
}

/**
 * Returns the current user + their role from the profiles table.
 * Returns null if not authenticated or if the role is not "admin".
 */
export async function requireAdmin(): Promise<{ userId: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const rows = await sql`
    SELECT role FROM profiles WHERE id = ${userId} LIMIT 1
  `;
  if (rows[0]?.role !== "admin") return null;
  return { userId };
}

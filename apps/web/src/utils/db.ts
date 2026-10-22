import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

/**
 * Neon serverless SQL client.
 *
 * Usage (tagged template — safe parameterisation):
 *   const rows = await sql`SELECT * FROM profiles WHERE id = ${userId}`;
 *
 * For dynamic queries (e.g. PATCH with variable SET clauses), use sqlQuery():
 *   const rows = await sqlQuery(`UPDATE t SET ${clauses} WHERE id = $1`, [id, ...vals]);
 */
export const sql = neon(process.env.DATABASE_URL);

/** Execute a raw SQL string with positional $1, $2... parameters. */
export async function sqlQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  return sql.query(query, params) as Promise<T[]>;
}

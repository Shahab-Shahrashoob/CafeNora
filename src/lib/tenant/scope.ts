import { eq, and, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * The single rule of CafeNora:
 *
 *   Every query against a tenant table MUST be scoped by the authenticated
 *   principal's cafeId. Never trust a cafeId from the request body, URL,
 *   query string, or header. It comes from the session, period.
 *
 * This helper makes the safe thing the easy thing:
 *
 *   const { rows } = await db.select().from(orders)
 *     .where(withCafe(orders.cafeId, session.cafeId, eq(orders.status, "pending")));
 *
 * The AND is always present, even if extra is undefined, so the query never
 * accidentally becomes unscoped during refactors.
 */
export function withCafe(
  column: PgColumn,
  cafeId: string,
  extra?: SQL,
): SQL {
  const scope = eq(column, cafeId);
  return extra ? and(scope, extra)! : scope;
}
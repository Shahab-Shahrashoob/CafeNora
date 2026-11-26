import { describe, it, expect } from "vitest";
import { sql, type SQL } from "drizzle-orm";
import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { withCafe } from "./scope";
import { assertSameCafe, TenantViolationError } from "./assert";

const orders = pgTable("orders", {
  id: uuid("id").primaryKey(),
  cafeId: uuid("cafe_id").notNull(),
  status: text("status").notNull(),
});

type ChunkLike = {
  name?: string;
  value?: unknown;
  queryChunks?: ChunkLike[];
};

function walkChunks(chunks: unknown[]): { columnNames: string[]; boundValues: unknown[] } {
  const columnNames: string[] = [];
  const boundValues: unknown[] = [];

  const visit = (c: unknown) => {
    if (c === null || c === undefined) return;
    if (typeof c !== "object") {
      boundValues.push(c);
      return;
    }
    const node = c as ChunkLike;
    if (typeof node.name === "string") columnNames.push(node.name);
    if ("value" in node && node.value !== undefined) boundValues.push(node.value);
    if (Array.isArray(node.queryChunks)) node.queryChunks.forEach(visit);
  };

  chunks.forEach(visit);
  return { columnNames, boundValues };
}

describe("withCafe", () => {
  it("produces a clause that references the cafe_id column and binds the cafe id", () => {
    const clause: SQL = withCafe(orders.cafeId, "cafe-a");
    const { columnNames, boundValues } = walkChunks(clause.queryChunks as unknown[]);
    expect(columnNames).toContain("cafe_id");
    expect(boundValues).toContain("cafe-a");
  });

  it("ANDs extra conditions when provided", () => {
    const clause = withCafe(orders.cafeId, "cafe-a", sql`status = 'pending'`);
    expect(clause).toBeTruthy();
  });
});

describe("assertSameCafe", () => {
  it("passes when ids match", () => {
    expect(() => assertSameCafe("a", "a")).not.toThrow();
  });
  it("throws TenantViolationError when they don't", () => {
    expect(() => assertSameCafe("a", "b")).toThrow(TenantViolationError);
  });
});
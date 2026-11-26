import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { staff, cafes } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/passwords";
import { startSession } from "@/lib/auth/session";

const bodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { username, password } = parsed.data;

  const [row] = await db
    .select({
      staffId: staff.id,
      cafeId: staff.cafeId,
      role: staff.role,
      passwordHash: staff.passwordHash,
      active: staff.active,
      cafeStatus: cafes.status,
    })
    .from(staff)
    .innerJoin(cafes, eq(staff.cafeId, cafes.id))
    .where(eq(staff.username, username))
    .limit(1);

  // Constant-ish time: always run verify even if user not found,
  // so timing doesn't reveal whether the username exists.
  const ok = row ? await verifyPassword(password, row.passwordHash) : false;

  if (!row || !ok || !row.active) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  if (row.cafeStatus !== "active") {
    return NextResponse.json({ error: "cafe_inactive" }, { status: 403 });
  }

  await startSession({
    kind: "staff",
    staffId: row.staffId,
    cafeId: row.cafeId,
    role: row.role,
  });

  return NextResponse.json({ ok: true });
}
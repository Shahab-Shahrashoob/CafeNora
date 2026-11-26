import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformAdmins } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/passwords";
import { startSession } from "@/lib/auth/session";

const bodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { username, password } = parsed.data;

  const [row] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.username, username))
    .limit(1);

  const ok = row ? await verifyPassword(password, row.passwordHash) : false;
  if (!row || !ok) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  await startSession({ kind: "platform_admin", adminId: row.id });
  return NextResponse.json({ ok: true });
}
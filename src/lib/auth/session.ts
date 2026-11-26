import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData =
  | { kind: "anonymous" }
  | { kind: "platform_admin"; adminId: string }
  | {
      kind: "staff";
      staffId: string;
      cafeId: string;
      role: "manager" | "barista";
    };

export const SESSION_COOKIE = "cn_session";

function options(ttlSeconds: number): SessionOptions {
  return {
    password: process.env.SESSION_SECRET!,
    cookieName: SESSION_COOKIE,
    ttl: ttlSeconds,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

// Read the current session without assuming a TTL for the write.
// Next.js's cookies() is async in 15/16.
export async function getSession() {
  const store = await cookies();
  return getIronSession<SessionData>(store, options(60 * 60 * 24 * 30));
}

// Call after a successful login to issue a fresh cookie with the right TTL.
export async function startSession(data: Exclude<SessionData, { kind: "anonymous" }>) {
  const ttl = data.kind === "platform_admin" ? 60 * 60 * 24 * 7 : 60 * 60 * 24 * 30;
  const store = await cookies();
  const session = await getIronSession<SessionData>(store, options(ttl));
  Object.assign(session, data);
  await session.save();
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}
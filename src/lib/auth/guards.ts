import { redirect } from "next/navigation";
import { getSession, type SessionData } from "./session";

export type StaffSession = Extract<SessionData, { kind: "staff" }>;
export type AdminSession = Extract<SessionData, { kind: "platform_admin" }>;

export async function requireStaff(): Promise<StaffSession> {
  const s = await getSession();
  if (s.kind !== "staff" || !s.staffId || !s.cafeId || !s.role) {
    redirect("/staff/login");
  }
  return {
    kind: "staff",
    staffId: s.staffId,
    cafeId: s.cafeId,
    role: s.role,
  };
}

export async function requireManager(): Promise<StaffSession> {
  const s = await requireStaff();
  if (s.role !== "manager") redirect("/staff");
  return s;
}

export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (s.kind !== "platform_admin" || !s.adminId) {
    redirect("/admin/login");
  }
  return { kind: "platform_admin", adminId: s.adminId };
}
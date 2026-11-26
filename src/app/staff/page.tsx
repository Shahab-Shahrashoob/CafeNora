import { requireStaff } from "@/lib/auth/guards";

export default async function StaffHome() {
  const s = await requireStaff();
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">پنل کارکنان</h1>
      <p className="mt-2 text-muted-foreground">
        نقش: {s.role === "manager" ? "مدیر" : "باریستا"}
      </p>
    </main>
  );
}
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminHome() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">پنل مدیریت پلتفرم</h1>
    </main>
  );
}
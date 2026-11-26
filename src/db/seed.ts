import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { db } from "./client";
import {
  cafes,
  staff,
  tables,
  menuCategories,
  menuItems,
  platformAdmins,
} from "./schema";

async function main() {
  console.log("Seeding…");

  // 1. Platform admin
  const adminUsername = "admin";
  const existingAdmin = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.username, adminUsername));

  if (existingAdmin.length === 0) {
    await db.insert(platformAdmins).values({
      username: adminUsername,
      passwordHash: await hash("admin-change-me"),
    });
    console.log("  ✓ platform admin created (username=admin, password=admin-change-me)");
  } else {
    console.log("  · platform admin already exists, skipping");
  }

  // 2. Demo café
  const slug = "demo-cafe";
  const existingCafe = await db.select().from(cafes).where(eq(cafes.slug, slug));

  if (existingCafe.length > 0) {
    console.log("  · demo café already exists, skipping");
    return;
  }

  const [cafe] = await db
    .insert(cafes)
    .values({
      slug,
      name: "کافه دمو",
      status: "active",
      ownerEmail: "owner@demo.local",
      ownerPhone: "09120000000",
      emailVerifiedAt: new Date(),
    })
    .returning();

  console.log(`  ✓ café created (id=${cafe.id}, slug=${slug})`);

  // 3. Manager + barista
  const [manager, barista] = await db
    .insert(staff)
    .values([
      {
        cafeId: cafe.id,
        role: "manager",
        username: "demo-manager",
        passwordHash: await hash("manager-change-me"),
        email: "manager@demo.local",
      },
      {
        cafeId: cafe.id,
        role: "barista",
        username: "demo-barista",
        passwordHash: await hash("barista-change-me"),
        email: "barista@demo.local",
      },
    ])
    .returning();

  console.log(`  ✓ manager (${manager.username}) + barista (${barista.username}) created`);

  // 4. Tables with random tokens
  const tableRows = await db
    .insert(tables)
    .values(
      [1, 2, 3].map((n) => ({
        cafeId: cafe.id,
        label: `میز ${n}`,
        token: randomBytes(16).toString("hex"),
      })),
    )
    .returning();

  console.log(`  ✓ ${tableRows.length} tables created`);
  for (const t of tableRows) {
    console.log(`    ${t.label}: /c/${slug}/t/${t.token}`);
  }

  // 5. Menu
  const [coffee, dessert] = await db
    .insert(menuCategories)
    .values([
      { cafeId: cafe.id, name: "قهوه", sortOrder: 1 },
      { cafeId: cafe.id, name: "دسر", sortOrder: 2 },
    ])
    .returning();

  await db.insert(menuItems).values([
    {
      cafeId: cafe.id,
      categoryId: coffee.id,
      name: "اسپرسو",
      description: "تک شات",
      priceToman: 80_000,
      sortOrder: 1,
    },
    {
      cafeId: cafe.id,
      categoryId: coffee.id,
      name: "کاپوچینو",
      description: "با شیر بخارپز",
      priceToman: 120_000,
      sortOrder: 2,
    },
    {
      cafeId: cafe.id,
      categoryId: coffee.id,
      name: "آمریکانو",
      priceToman: 100_000,
      sortOrder: 3,
    },
    {
      cafeId: cafe.id,
      categoryId: dessert.id,
      name: "چیزکیک",
      priceToman: 150_000,
      sortOrder: 1,
    },
    {
      cafeId: cafe.id,
      categoryId: dessert.id,
      name: "براونی",
      priceToman: 130_000,
      sortOrder: 2,
    },
  ]);

  console.log("  ✓ menu created (2 categories, 5 items)");
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
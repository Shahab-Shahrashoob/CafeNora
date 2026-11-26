import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export const cafeStatusEnum = pgEnum("cafe_status", ["pending", "active", "suspended"]);

export const staffRoleEnum = pgEnum("staff_role", ["manager", "barista"]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "served",
  "cancelled",
]);

export const sessionStatusEnum = pgEnum("session_status", ["open", "closed"]);

// ─────────────────────────────────────────────────────────────
// Platform
// ─────────────────────────────────────────────────────────────

// The platform admin (you). Not tied to any café.
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Cafés (tenants)
// ─────────────────────────────────────────────────────────────

export const cafes = pgTable(
  "cafes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: cafeStatusEnum("status").notNull().default("pending"),
    // per-cafe settings: order cap, session auto-close hours, etc.
    settings: jsonb("settings")
      .$type<{
        maxOpenOrdersPerSession: number;
        sessionAutoCloseHours: number;
      }>()
      .notNull()
      .default({ maxOpenOrdersPerSession: 5, sessionAutoCloseHours: 4 }),
    ownerEmail: text("owner_email").notNull(),
    ownerPhone: text("owner_phone").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
  },
  (t) => ({
    slugUnique: uniqueIndex("cafes_slug_unique").on(t.slug),
    statusIdx: index("cafes_status_idx").on(t.status),
  }),
);

// One row per staff member. Exactly one manager + one barista per café,
// enforced by the composite unique index below.
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    role: staffRoleEnum("role").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    email: text("email").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cafeRoleUnique: uniqueIndex("staff_cafe_role_unique").on(t.cafeId, t.role),
    usernameUnique: uniqueIndex("staff_username_unique").on(t.username),
  }),
);

// ─────────────────────────────────────────────────────────────
// Tables + QR tokens
// ─────────────────────────────────────────────────────────────

// `token` is what the QR encodes. Random per table, rotatable by the manager.
// `label` is the human-facing name ("میز ۳").
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    token: text("token").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUnique: uniqueIndex("tables_token_unique").on(t.token),
    cafeIdx: index("tables_cafe_idx").on(t.cafeId),
  }),
);

// ─────────────────────────────────────────────────────────────
// Menu
// ─────────────────────────────────────────────────────────────

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    cafeIdx: index("menu_categories_cafe_idx").on(t.cafeId),
  }),
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Toman, integer. Never floats for money.
    priceToman: integer("price_toman").notNull(),
    imagePath: text("image_path"),
    available: boolean("available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cafeIdx: index("menu_items_cafe_idx").on(t.cafeId),
    categoryIdx: index("menu_items_category_idx").on(t.categoryId),
  }),
);

// ─────────────────────────────────────────────────────────────
// Sessions + orders
// ─────────────────────────────────────────────────────────────

// A session opens on the first scan of a table's QR and closes when staff
// marks it paid (or auto-closes after N hours of inactivity).
export const tableSessions = pgTable(
  "table_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "restrict" }),
    status: sessionStatusEnum("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByStaffId: uuid("closed_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    closeReason: text("close_reason"),
    // Sum of *served* orders only, computed at close time.
    paidTotalToman: integer("paid_total_toman"),
  },
  (t) => ({
    cafeStatusIdx: index("table_sessions_cafe_status_idx").on(t.cafeId, t.status),
    tableStatusIdx: index("table_sessions_table_status_idx").on(t.tableId, t.status),
  }),
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => tableSessions.id, { onDelete: "restrict" }),
    // Denormalized for fast per-cafe queries; always equal to session's table.
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    // Client-supplied UUID, unique per session — idempotency guard.
    idempotencyKey: text("idempotency_key").notNull(),
    note: text("note"),
    totalToman: integer("total_toman").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    preparingAt: timestamp("preparing_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    servedAt: timestamp("served_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByStaffId: uuid("cancelled_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    cancelReason: text("cancel_reason"),
  },
  (t) => ({
    sessionIdempotencyUnique: uniqueIndex("orders_session_idempotency_unique").on(
      t.sessionId,
      t.idempotencyKey,
    ),
    cafeStatusCreatedIdx: index("orders_cafe_status_created_idx").on(
      t.cafeId,
      t.status,
      t.createdAt,
    ),
    sessionIdx: index("orders_session_idx").on(t.sessionId),
  }),
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id").references(() => menuItems.id, {
      onDelete: "set null",
    }),
    // Snapshot at order time so menu edits never rewrite history.
    nameSnapshot: text("name_snapshot").notNull(),
    priceSnapshotToman: integer("price_snapshot_toman").notNull(),
    qty: integer("qty").notNull(),
    note: text("note"),
  },
  (t) => ({
    orderIdx: index("order_items_order_idx").on(t.orderId),
  }),
);

// ─────────────────────────────────────────────────────────────
// Audit + email tokens
// ─────────────────────────────────────────────────────────────

// Every privileged action writes a row. `cafeId` nullable for platform-level.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").references(() => cafes.id, { onDelete: "set null" }),
    actorType: text("actor_type").notNull(), // "platform_admin" | "manager" | "barista" | "system"
    actorId: uuid("actor_id"),
    action: text("action").notNull(), // e.g. "order.accepted"
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cafeCreatedIdx: index("audit_log_cafe_created_idx").on(t.cafeId, t.createdAt),
  }),
);

// Single-use tokens for email verification + password reset.
// We store only a hash of the token, never the token itself.
export const emailTokens = pgTable(
  "email_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull(), // "verify_email" | "reset_password"
    subjectType: text("subject_type").notNull(), // "cafe" | "staff"
    subjectId: uuid("subject_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenHashUnique: uniqueIndex("email_tokens_hash_unique").on(t.tokenHash),
  }),
);

// ─────────────────────────────────────────────────────────────
// Relations (for Drizzle's query builder — optional but useful)
// ─────────────────────────────────────────────────────────────

export const cafesRelations = relations(cafes, ({ many }) => ({
  staff: many(staff),
  tables: many(tables),
  categories: many(menuCategories),
  items: many(menuItems),
  sessions: many(tableSessions),
  orders: many(orders),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  cafe: one(cafes, { fields: [staff.cafeId], references: [cafes.id] }),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  cafe: one(cafes, { fields: [tables.cafeId], references: [cafes.id] }),
  sessions: many(tableSessions),
}));

export const menuCategoriesRelations = relations(menuCategories, ({ one, many }) => ({
  cafe: one(cafes, { fields: [menuCategories.cafeId], references: [cafes.id] }),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  cafe: one(cafes, { fields: [menuItems.cafeId], references: [cafes.id] }),
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
}));

export const tableSessionsRelations = relations(tableSessions, ({ one, many }) => ({
  cafe: one(cafes, { fields: [tableSessions.cafeId], references: [cafes.id] }),
  table: one(tables, { fields: [tableSessions.tableId], references: [tables.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  cafe: one(cafes, { fields: [orders.cafeId], references: [cafes.id] }),
  session: one(tableSessions, {
    fields: [orders.sessionId],
    references: [tableSessions.id],
  }),
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type Cafe = typeof cafes.$inferSelect;
export type NewCafe = typeof cafes.$inferInsert;
export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;
export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type TableSession = typeof tableSessions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
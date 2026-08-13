import { sql } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { uuidv7 } from "../id";

/* ------------------------------------------------------------------ *
 * Column helpers
 *
 * Instants are INTEGER unix millis (UTC). Calendar dates are TEXT
 * 'YYYY-MM-DD' with no zone — see docs/plan.md §3.
 * ------------------------------------------------------------------ */

const pk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

/**
 * Soft author reference. Nullable, and SET NULL on delete — never CASCADE.
 * Removing a user must leave every meal, plan and schedule entry intact.
 */
const authorRef = (column: string) =>
  text(column).references(() => user.id, { onDelete: "set null" });

/* ------------------------------------------------------------------ *
 * Auth — owned by Better Auth.
 *
 * Field shapes verified against `getAuthTables()` from @better-auth/core,
 * not from memory. The adapter matches on the Drizzle *property* name, so
 * snake_case column names underneath are fine.
 *
 * `isAdmin` is our own addition, declared to Better Auth as an additional
 * field with `input: false` so it can never be set through the sign-up API.
 * ------------------------------------------------------------------ */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  /**
   * Set when an admin issues a temporary password. The app shell redirects to
   * the change-password screen until it is cleared, so a password someone else
   * knows cannot stay in use.
   */
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Hashed by Better Auth for the credential provider. Never plaintext. */
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const inviteCode = sqliteTable(
  "invite_code",
  {
    code: text("code").primaryKey(),
    createdById: authorRef("created_by_id"),
    usedById: authorRef("used_by_id"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("invite_code_used_at_idx").on(t.usedAt)],
);

/* ------------------------------------------------------------------ *
 * Meals
 * ------------------------------------------------------------------ */

export const meal = sqliteTable(
  "meal",
  {
    id: pk(),
    name: text("name").notNull(),
    /** Display-only reference ("Serves 4"). Deliberately excluded from shopping-list maths. */
    servings: integer("servings"),
    prepMins: integer("prep_mins"),
    cookMins: integer("cook_mins"),
    /** Denormalised from meal_image so list views can build a cache-busting URL without a join. */
    imageHash: text("image_hash"),
    createdById: authorRef("created_by_id"),
    updatedById: authorRef("updated_by_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("meal_name_idx").on(t.name),
    check(
      "meal_servings_positive",
      sql`${t.servings} IS NULL OR ${t.servings} > 0`,
    ),
  ],
);

/**
 * Images live in their own table so `SELECT ... FROM meal` never drags BLOB
 * bytes through the page cache. This is the single biggest factor in how fast
 * the meal list feels on mobile.
 */
export const mealImage = sqliteTable("meal_image", {
  mealId: text("meal_id")
    .primaryKey()
    .references(() => meal.id, { onDelete: "cascade" }),
  full: blob("full", { mode: "buffer" }).notNull(),
  thumb: blob("thumb", { mode: "buffer" }).notNull(),
  mime: text("mime").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  hash: text("hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const mealIngredient = sqliteTable(
  "meal_ingredient",
  {
    id: pk(),
    mealId: text("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    quantity: real("quantity").notNull(),
    /** Validated in app code against the unit table in docs/plan.md §4. */
    unit: text("unit").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    unique("meal_ingredient_position_uq").on(t.mealId, t.position),
    index("meal_ingredient_meal_idx").on(t.mealId),
    check("meal_ingredient_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

/**
 * Method steps, replacing the old freeform `notes` field. "Step 1", "Step 2"
 * etc. are display-only, derived from array position — never stored.
 */
export const mealStep = sqliteTable(
  "meal_step",
  {
    id: pk(),
    mealId: text("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    unique("meal_step_position_uq").on(t.mealId, t.position),
    index("meal_step_meal_idx").on(t.mealId),
  ],
);

/* ------------------------------------------------------------------ *
 * Plans — unscheduled playlists. Deliberately unlinked from the schedule.
 * ------------------------------------------------------------------ */

export const plan = sqliteTable(
  "plan",
  {
    id: pk(),
    name: text("name").notNull(),
    description: text("description"),
    createdById: authorRef("created_by_id"),
    updatedById: authorRef("updated_by_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("plan_name_idx").on(t.name)],
);

export const planItem = sqliteTable(
  "plan_item",
  {
    id: pk(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    mealId: text("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("plan_item_meal_uq").on(t.planId, t.mealId),
    unique("plan_item_position_uq").on(t.planId, t.position),
    index("plan_item_plan_idx").on(t.planId),
  ],
);

/* ------------------------------------------------------------------ *
 * Schedule — one shared household calendar.
 * ------------------------------------------------------------------ */

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const scheduleEntry = sqliteTable(
  "schedule_entry",
  {
    id: pk(),
    /** Calendar date as 'YYYY-MM-DD'. Not an instant — never timezone-converted. */
    date: text("date").notNull(),
    slot: text("slot", { enum: MEAL_SLOTS }).notNull(),
    mealId: text("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    createdById: authorRef("created_by_id"),
    updatedById: authorRef("updated_by_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Several meals may share a slot; the same meal may not appear twice in one.
    unique("schedule_entry_uq").on(t.date, t.slot, t.mealId),
    index("schedule_entry_date_idx").on(t.date),
    // Cheap guard against a timestamp ever being written into a date column.
    // NB: GLOB is Unix-glob syntax — '?' is the single-char wildcard and '_'
    // is a literal underscore. Character classes keep this digits-only.
    check(
      "schedule_entry_date_format",
      sql`${t.date} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
  ],
);

/* ------------------------------------------------------------------ *
 * Tags — one vocabulary, on meals only. Plans have no tags of their own:
 * a plan's tags are the derived union of its meals' tags (lib/tags/queries,
 * `tagsForPlansViaMeals`), computed live rather than stored, so there's
 * nothing to keep in sync as meals are added, removed, or retagged.
 * Case-insensitive de-duplication happens in app code (see lib/tags), not
 * here; the household's tag count stays small enough that a plain unique
 * index is enough of a backstop against an exact-case race.
 * ------------------------------------------------------------------ */

export const tag = sqliteTable(
  "tag",
  {
    id: pk(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("tag_name_uq").on(t.name)],
);

export const mealTag = sqliteTable(
  "meal_tag",
  {
    mealId: text("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.mealId, t.tagId] }),
    index("meal_tag_tag_idx").on(t.tagId),
  ],
);

/* ------------------------------------------------------------------ *
 * Saved shopping lists — the one genuinely personal, per-user-owned
 * corner of this app. Every other user reference above is a soft
 * `authorRef` (nullable, SET NULL) because shared content must outlive its
 * author; a saved shopping list is the opposite of shared, so it takes a
 * hard NOT NULL owner with ON DELETE CASCADE instead — deleting a user
 * deletes their saved lists with them.
 * ------------------------------------------------------------------ */

export const shoppingList = sqliteTable(
  "shopping_list",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Pinned lists sort to the top of the index, ahead of recency. */
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("shopping_list_user_idx").on(t.userId)],
);

export const shoppingListItem = sqliteTable(
  "shopping_list_item",
  {
    id: pk(),
    shoppingListId: text("shopping_list_id")
      .notNull()
      .references(() => shoppingList.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    /** JSON-encoded `Measure[]` (lib/units.ts) — small, fixed shape, written once at save time. */
    measuresJson: text("measures_json").notNull(),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    unique("shopping_list_item_position_uq").on(t.shoppingListId, t.position),
    index("shopping_list_item_list_idx").on(t.shoppingListId),
  ],
);

/* ------------------------------------------------------------------ *
 * Pins — a third reference pattern, distinct from both of the above. Meals
 * and Plans are shared content (soft `authorRef`), but a pin on one is a
 * genuinely personal opinion: *my* pins must never appear for another
 * signed-in user. So unlike `authorRef`, both FKs here are hard CASCADE —
 * meaningless without the user, meaningless without the meal/plan — but
 * unlike shopping lists, the pin's own lifecycle never affects the shared
 * content itself. Mirrors `mealTag`'s composite-PK shape exactly.
 * ------------------------------------------------------------------ */

export const mealPin = sqliteTable(
  "meal_pin",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mealId: text("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.mealId] }),
    index("meal_pin_meal_idx").on(t.mealId),
  ],
);

export const planPin = sqliteTable(
  "plan_pin",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.planId] }),
    index("plan_pin_plan_idx").on(t.planId),
  ],
);


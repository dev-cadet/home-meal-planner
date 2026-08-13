import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { uuidv7 } from "../id";
import { createDatabase, type DatabaseHandle } from "./client";
import { runMigrations } from "./migrate";
import {
  meal,
  mealIngredient,
  mealPin,
  mealTag,
  plan,
  planItem,
  planPin,
  scheduleEntry,
  shoppingList,
  shoppingListItem,
  tag,
  user,
} from "./schema";

let handle: DatabaseHandle;

/**
 * Drizzle query builders are thenables, not real Promises, which some
 * `expect().rejects` implementations refuse to unwrap. Coercing to a genuine
 * Promise keeps rejection assertions honest across runners.
 */
const run = <T>(query: PromiseLike<T>): Promise<T> => Promise.resolve(query);

async function makeUser(name = "Test User") {
  const id = uuidv7();
  await handle.db.insert(user).values({
    id,
    name,
    email: `${id}@example.test`,
  });
  return id;
}

async function makeMeal(createdById?: string) {
  const [row] = await handle.db
    .insert(meal)
    .values({ name: "Thai green curry", servings: 4, createdById, updatedById: createdById })
    .returning();
  return row!;
}

beforeEach(async () => {
  handle = await createDatabase(":memory:");
  await runMigrations(handle);
});

afterEach(() => {
  handle.close();
});

describe("foreign key enforcement", () => {
  it("has foreign_keys actually enabled", async () => {
    const result = await handle.client.execute("PRAGMA foreign_keys");
    expect(result.rows[0]).toMatchObject({ foreign_keys: 1 });
  });

  it("rejects a reference to a non-existent row", async () => {
    await expect(
      run(
        handle.db.insert(mealIngredient).values({
          mealId: "does-not-exist",
          position: 0,
          quantity: 1,
          unit: "g",
          name: "orphan",
        }),
      ),
    ).rejects.toThrow();
  });
});

/**
 * The requirement this protects: deleting a user must never damage content.
 *
 * If `foreign_keys` were off, SQLite would silently ignore ON DELETE SET NULL
 * and leave a dangling author id behind. Nothing would error — the data would
 * just quietly be wrong. Hence a behavioural test, not just a pragma check.
 */
describe("soft author references", () => {
  it("nulls the author but keeps the meal when a user is deleted", async () => {
    const userId = await makeUser();
    const created = await makeMeal(userId);

    expect(created.createdById).toBe(userId);

    await handle.db.delete(user).where(eq(user.id, userId));

    const [after] = await handle.db.select().from(meal).where(eq(meal.id, created.id));

    expect(after).toBeDefined();
    expect(after!.name).toBe("Thai green curry");
    expect(after!.createdById).toBeNull();
    expect(after!.updatedById).toBeNull();
  });

  it("keeps plans and schedule entries after their author is deleted", async () => {
    const userId = await makeUser();
    const created = await makeMeal(userId);

    await handle.db.insert(plan).values({ name: "Weeknights", createdById: userId });
    await handle.db.insert(scheduleEntry).values({
      date: "2026-08-18",
      slot: "dinner",
      mealId: created.id,
      createdById: userId,
    });

    await handle.db.delete(user).where(eq(user.id, userId));

    const plans = await handle.db.select().from(plan);
    const entries = await handle.db.select().from(scheduleEntry);

    expect(plans).toHaveLength(1);
    expect(plans[0]!.createdById).toBeNull();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.createdById).toBeNull();
    expect(entries[0]!.date).toBe("2026-08-18");
  });
});

describe("content cascades", () => {
  it("removes ingredients and plan items when a meal is deleted", async () => {
    const created = await makeMeal();

    await handle.db.insert(mealIngredient).values({
      mealId: created.id,
      position: 0,
      quantity: 200,
      unit: "g",
      name: "green beans",
    });

    const [p] = await handle.db.insert(plan).values({ name: "Weeknights" }).returning();
    await handle.db
      .insert(planItem)
      .values({ planId: p!.id, mealId: created.id, position: 0 });

    await handle.db.delete(meal).where(eq(meal.id, created.id));

    expect(await handle.db.select().from(mealIngredient)).toHaveLength(0);
    expect(await handle.db.select().from(planItem)).toHaveLength(0);
    // The plan itself survives — only its item referenced the meal.
    expect(await handle.db.select().from(plan)).toHaveLength(1);
  });

  it("removes a meal's tag associations when the meal is deleted, but keeps the tag", async () => {
    const created = await makeMeal();
    const [t] = await handle.db.insert(tag).values({ name: "vegan" }).returning();

    await handle.db.insert(mealTag).values({ mealId: created.id, tagId: t!.id });
    await handle.db.delete(meal).where(eq(meal.id, created.id));

    expect(await handle.db.select().from(mealTag)).toHaveLength(0);
    // Deleting a meal has no FK path to `tag` at all — it survives untouched.
    expect(await handle.db.select().from(tag)).toHaveLength(1);
  });
});

/**
 * A third reference pattern: a pin is a genuinely personal opinion layered
 * on top of shared content (unlike `authorRef`, both FKs are hard CASCADE —
 * meaningless without the user, meaningless without the meal/plan — but
 * unlike shopping lists, the pin's own lifecycle never affects the shared
 * content itself).
 */
describe("per-user pins on shared content", () => {
  it("deletes a user's pins when the user is deleted, leaving the meal/plan intact", async () => {
    const userId = await makeUser();
    const created = await makeMeal();
    const [p] = await handle.db.insert(plan).values({ name: "Weeknights" }).returning();

    await handle.db.insert(mealPin).values({ userId, mealId: created.id });
    await handle.db.insert(planPin).values({ userId, planId: p!.id });

    await handle.db.delete(user).where(eq(user.id, userId));

    expect(await handle.db.select().from(mealPin)).toHaveLength(0);
    expect(await handle.db.select().from(planPin)).toHaveLength(0);
    expect(await handle.db.select().from(meal)).toHaveLength(1);
    expect(await handle.db.select().from(plan)).toHaveLength(1);
  });

  it("deletes a meal's/plan's pins when the meal/plan is deleted", async () => {
    const userId = await makeUser();
    const created = await makeMeal();
    const [p] = await handle.db.insert(plan).values({ name: "Weeknights" }).returning();

    await handle.db.insert(mealPin).values({ userId, mealId: created.id });
    await handle.db.insert(planPin).values({ userId, planId: p!.id });

    await handle.db.delete(meal).where(eq(meal.id, created.id));
    await handle.db.delete(plan).where(eq(plan.id, p!.id));

    expect(await handle.db.select().from(mealPin)).toHaveLength(0);
    expect(await handle.db.select().from(planPin)).toHaveLength(0);
  });
});

/**
 * The opposite requirement to "soft author references" above: a saved
 * shopping list is genuinely personal, not shared household content, so it
 * takes a hard NOT NULL owner with ON DELETE CASCADE instead of a soft
 * `authorRef`. Same reasoning as the SET NULL tests — without `foreign_keys`
 * actually on, this would silently leave orphaned rows behind instead of
 * erroring, so it gets a behavioural test, not just a schema read.
 */
describe("hard-owned personal content", () => {
  it("deletes a user's saved shopping lists, and their items, when the user is deleted", async () => {
    const userId = await makeUser();
    const [list] = await handle.db
      .insert(shoppingList)
      .values({ userId, name: "Weeknights" })
      .returning();
    await handle.db.insert(shoppingListItem).values({
      shoppingListId: list!.id,
      position: 0,
      name: "onions",
      measuresJson: JSON.stringify([{ quantity: 3, unit: "count" }]),
    });

    await handle.db.delete(user).where(eq(user.id, userId));

    expect(await handle.db.select().from(shoppingList)).toHaveLength(0);
    expect(await handle.db.select().from(shoppingListItem)).toHaveLength(0);
  });

  it("rejects a shopping list with no owner", async () => {
    await expect(
      run(
        handle.db
          .insert(shoppingList)
          // @ts-expect-error deliberately omitting the required userId
          .values({ name: "Weeknights" }),
      ),
    ).rejects.toThrow();
  });
});

describe("check constraints", () => {
  it("rejects a non-positive ingredient quantity", async () => {
    const created = await makeMeal();

    await expect(
      run(
        handle.db.insert(mealIngredient).values({
          mealId: created.id,
          position: 0,
          quantity: 0,
          unit: "g",
          name: "nothing",
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects a schedule date that is not YYYY-MM-DD", async () => {
    const created = await makeMeal();

    await expect(
      run(
        handle.db.insert(scheduleEntry).values({
          // An instant leaking into a calendar-date column is the bug this guards.
          date: "2026-08-18T00:00:00.000Z",
          slot: "dinner",
          mealId: created.id,
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects zero or negative servings", async () => {
    await expect(
      run(handle.db.insert(meal).values({ name: "Impossible", servings: 0 })),
    ).rejects.toThrow();
  });
});

describe("uniqueness", () => {
  it("allows several meals in one slot but not the same meal twice", async () => {
    const a = await makeMeal();
    const [b] = await handle.db.insert(meal).values({ name: "Salad" }).returning();

    await handle.db
      .insert(scheduleEntry)
      .values({ date: "2026-08-18", slot: "dinner", mealId: a.id });
    await handle.db
      .insert(scheduleEntry)
      .values({ date: "2026-08-18", slot: "dinner", mealId: b!.id });

    expect(await handle.db.select().from(scheduleEntry)).toHaveLength(2);

    await expect(
      run(
        handle.db
          .insert(scheduleEntry)
          .values({ date: "2026-08-18", slot: "dinner", mealId: a.id }),
      ),
    ).rejects.toThrow();
  });

  it("rejects duplicate ingredient positions within a meal", async () => {
    const created = await makeMeal();
    const row = { mealId: created.id, position: 0, quantity: 1, unit: "g", name: "salt" };

    await handle.db.insert(mealIngredient).values(row);
    await expect(
      run(handle.db.insert(mealIngredient).values({ ...row, name: "pepper" })),
    ).rejects.toThrow();
  });

  it("rejects an exact-case duplicate tag name", async () => {
    await handle.db.insert(tag).values({ name: "vegan" });
    await expect(run(handle.db.insert(tag).values({ name: "vegan" }))).rejects.toThrow();
  });
});

describe("on-disk database", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "hmp-"));
  });

  afterEach(() => {
    // Windows keeps a lock on the SQLite file after close(), so removal can
    // fail with EPERM. Tidying the OS temp directory is not what these tests
    // assert, and it must never turn a passing suite red.
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      // Left for the OS to reclaim.
    }
  });

  it("runs in WAL mode with the expected pragmas", async () => {
    const disk = await createDatabase(join(dir, "nested", "app.db"));
    try {
      const journal = await disk.client.execute("PRAGMA journal_mode");
      const fk = await disk.client.execute("PRAGMA foreign_keys");

      expect(journal.rows[0]).toMatchObject({ journal_mode: "wal" });
      expect(fk.rows[0]).toMatchObject({ foreign_keys: 1 });
    } finally {
      disk.close();
    }
  });

  it("migrates a fresh file and round-trips a meal", async () => {
    const disk = await createDatabase(join(dir, "app.db"));
    try {
      await runMigrations(disk);
      await disk.db.insert(meal).values({ name: "Shakshuka", servings: 2 });

      const [found] = await disk.db.select().from(meal);
      expect(found!.name).toBe("Shakshuka");
      expect(found!.createdAt).toBeInstanceOf(Date);
    } finally {
      disk.close();
    }
  });
});

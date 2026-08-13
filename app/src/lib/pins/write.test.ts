import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { uuidv7 } from "../id";
import { createTestDatabase, type TestDatabase } from "../db/testing";
import { meal, mealPin, plan, planPin, user } from "../db/schema";
import { setMealPinned, setPlanPinned } from "./write";

let handle: TestDatabase;
let userId: string;
let mealId: string;
let planId: string;

beforeEach(async () => {
  handle = await createTestDatabase();

  userId = uuidv7();
  await handle.db.insert(user).values({ id: userId, name: "Owner", email: `${userId}@example.test` });

  const [m] = await handle.db.insert(meal).values({ name: "Dhal" }).returning({ id: meal.id });
  mealId = m!.id;

  const [p] = await handle.db.insert(plan).values({ name: "Weeknights" }).returning({ id: plan.id });
  planId = p!.id;
});

afterEach(() => {
  handle.cleanup();
});

describe("setMealPinned", () => {
  it("pins and unpins", async () => {
    await setMealPinned(handle.db, userId, mealId, true);
    expect(await handle.db.select().from(mealPin)).toHaveLength(1);

    await setMealPinned(handle.db, userId, mealId, false);
    expect(await handle.db.select().from(mealPin)).toHaveLength(0);
  });

  it("pinning twice does not error or duplicate", async () => {
    await setMealPinned(handle.db, userId, mealId, true);
    await setMealPinned(handle.db, userId, mealId, true);
    expect(await handle.db.select().from(mealPin)).toHaveLength(1);
  });

  it("unpinning when not pinned does not error", async () => {
    await setMealPinned(handle.db, userId, mealId, false);
    expect(await handle.db.select().from(mealPin)).toHaveLength(0);
  });
});

describe("setPlanPinned", () => {
  it("pins and unpins", async () => {
    await setPlanPinned(handle.db, userId, planId, true);
    expect(await handle.db.select().from(planPin)).toHaveLength(1);

    await setPlanPinned(handle.db, userId, planId, false);
    expect(await handle.db.select().from(planPin)).toHaveLength(0);
  });

  it("pinning twice does not error or duplicate", async () => {
    await setPlanPinned(handle.db, userId, planId, true);
    await setPlanPinned(handle.db, userId, planId, true);
    expect(await handle.db.select().from(planPin)).toHaveLength(1);
  });

  it("unpinning when not pinned does not error", async () => {
    await setPlanPinned(handle.db, userId, planId, false);
    expect(await handle.db.select().from(planPin)).toHaveLength(0);
  });
});

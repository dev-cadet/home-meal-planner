import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createTestDatabase, type TestDatabase } from "../db/testing";
import { asc, eq } from "drizzle-orm";

import { meal, plan, planItem } from "../db/schema";
import { currentOrder, moveInOrder, setPlanOrder } from "./ordering";

let handle: TestDatabase;
let planId: string;
let mealIds: string[];

beforeEach(async () => {
  handle = await createTestDatabase();

  const [p] = await handle.db
    .insert(plan)
    .values({ name: "Weeknights" })
    .returning({ id: plan.id });
  planId = p!.id;

  const rows = await handle.db
    .insert(meal)
    .values(["Curry", "Bolognese", "Dhal", "Fajitas"].map((name) => ({ name })))
    .returning({ id: meal.id });
  mealIds = rows.map((r) => r.id);

  await setPlanOrder(handle.db, planId, mealIds);
});

afterEach(() => {
  handle.cleanup();
});

async function positions() {
  return handle.db
    .select({ mealId: planItem.mealId, position: planItem.position })
    .from(planItem)
    .where(eq(planItem.planId, planId))
    .orderBy(asc(planItem.position));
}

describe("moveInOrder", () => {
  const order = ["a", "b", "c"];

  it("swaps with the previous item", () => {
    expect(moveInOrder(order, "b", "up")).toEqual(["b", "a", "c"]);
  });

  it("swaps with the next item", () => {
    expect(moveInOrder(order, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("is a no-op at the boundaries", () => {
    expect(moveInOrder(order, "a", "up")).toEqual(order);
    expect(moveInOrder(order, "c", "down")).toEqual(order);
  });

  it("is a no-op for an unknown id", () => {
    expect(moveInOrder(order, "zzz", "up")).toEqual(order);
  });

  it("does not mutate the input", () => {
    const input = ["a", "b", "c"];
    moveInOrder(input, "b", "up");
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("setPlanOrder", () => {
  it("writes contiguous positions from zero", async () => {
    expect(await positions()).toEqual([
      { mealId: mealIds[0]!, position: 0 },
      { mealId: mealIds[1]!, position: 1 },
      { mealId: mealIds[2]!, position: 2 },
      { mealId: mealIds[3]!, position: 3 },
    ]);
  });

  /**
   * The reason this function exists: UNIQUE(plan_id, position) makes a naive
   * in-place swap collide the moment two rows share a position.
   */
  it("survives a full reversal without violating the unique constraint", async () => {
    await setPlanOrder(handle.db, planId, [...mealIds].reverse());

    expect(await currentOrder(handle.db, planId)).toEqual([...mealIds].reverse());
    expect((await positions()).map((p) => p.position)).toEqual([0, 1, 2, 3]);
  });

  it("handles a single-step swap", async () => {
    const swapped = moveInOrder(mealIds, mealIds[1]!, "up");
    await setPlanOrder(handle.db, planId, swapped);

    expect(await currentOrder(handle.db, planId)).toEqual([
      mealIds[1]!,
      mealIds[0]!,
      mealIds[2]!,
      mealIds[3]!,
    ]);
  });

  it("closes gaps when an item is dropped", async () => {
    const without = mealIds.filter((id) => id !== mealIds[1]);
    await setPlanOrder(handle.db, planId, without);

    expect((await positions()).map((p) => p.position)).toEqual([0, 1, 2]);
    expect(await currentOrder(handle.db, planId)).toEqual(without);
  });

  it("empties the plan cleanly", async () => {
    await setPlanOrder(handle.db, planId, []);
    expect(await positions()).toEqual([]);
  });

  it("leaves the meals themselves untouched", async () => {
    await setPlanOrder(handle.db, planId, []);
    expect(await handle.db.select().from(meal)).toHaveLength(4);
  });

  /** A partially applied reorder would be worse than a rejected one. */
  it("rolls back entirely if the new order is invalid", async () => {
    const before = await currentOrder(handle.db, planId);

    await expect(
      setPlanOrder(handle.db, planId, [...mealIds, "no-such-meal"]),
    ).rejects.toThrow();

    expect(await currentOrder(handle.db, planId)).toEqual(before);
  });
});

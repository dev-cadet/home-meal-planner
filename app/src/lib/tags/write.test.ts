import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { meal, tag } from "../db/schema";
import { createTestDatabase, type TestDatabase } from "../db/testing";
import { writeMealTags } from "./write";

let handle: TestDatabase;
let mealId: string;

beforeEach(async () => {
  handle = await createTestDatabase();

  const [m] = await handle.db.insert(meal).values({ name: "Dhal" }).returning({ id: meal.id });
  mealId = m!.id;
});

afterEach(() => {
  handle.cleanup();
});

async function mealTagNames() {
  const rows = await handle.db.select({ name: tag.name }).from(tag);
  return rows.map((r) => r.name).sort();
}

describe("writeMealTags", () => {
  it("creates tags on first write and reuses them case-insensitively on the next", async () => {
    await writeMealTags(handle.db, mealId, ["Vegan", "quick"]);
    expect(await mealTagNames()).toEqual(["Vegan", "quick"]);

    // A second meal reusing "vegan" (different case) must not create a duplicate row.
    const [m2] = await handle.db.insert(meal).values({ name: "Salad" }).returning({ id: meal.id });
    await writeMealTags(handle.db, m2!.id, ["vegan"]);
    expect(await mealTagNames()).toEqual(["Vegan", "quick"]);
  });

  it("deletes a tag once its last association is removed", async () => {
    await writeMealTags(handle.db, mealId, ["one-off"]);
    expect(await mealTagNames()).toEqual(["one-off"]);

    // Rewriting this meal's tags to an empty set drops its only association.
    await writeMealTags(handle.db, mealId, []);
    expect(await mealTagNames()).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { uuidv7 } from "../id";
import { createTestDatabase, type TestDatabase } from "../db/testing";
import { shoppingList, shoppingListItem, user } from "../db/schema";
import {
  addShoppingListItemForUser,
  createShoppingListForUser,
  getShoppingListForUser,
  hasShoppingListNamedForUser,
  listShoppingListsForUser,
  removeShoppingListItemForUser,
  renameShoppingListForUser,
  resetShoppingListCheckedForUser,
  toggleShoppingListItemForUser,
  togglePinShoppingListForUser,
} from "./records";

let handle: TestDatabase;
let ownerId: string;
let otherId: string;

async function makeUser(name: string) {
  const id = uuidv7();
  await handle.db.insert(user).values({ id, name, email: `${id}@example.test` });
  return id;
}

async function makeList(userId: string, name: string) {
  const [row] = await handle.db
    .insert(shoppingList)
    .values({ userId, name })
    .returning({ id: shoppingList.id });

  const [item] = await handle.db
    .insert(shoppingListItem)
    .values({
      shoppingListId: row!.id,
      position: 0,
      name: "onions",
      measuresJson: JSON.stringify([{ quantity: 3, unit: "count" }]),
    })
    .returning({ id: shoppingListItem.id });

  return { listId: row!.id, itemId: item!.id };
}

beforeEach(async () => {
  handle = await createTestDatabase();
  ownerId = await makeUser("Owner");
  otherId = await makeUser("Someone Else");
});

afterEach(() => {
  handle.cleanup();
});

describe("listShoppingListsForUser", () => {
  it("only returns the given user's lists", async () => {
    await makeList(ownerId, "Weeknights");
    await makeList(otherId, "Someone else's list");

    const lists = await listShoppingListsForUser(handle.db, ownerId);

    expect(lists).toHaveLength(1);
    expect(lists[0]!.name).toBe("Weeknights");
  });

  it("reports item and checked counts", async () => {
    const { listId, itemId } = await makeList(ownerId, "Weeknights");
    await toggleShoppingListItemForUser(handle.db, ownerId, listId, itemId, true);

    const [summary] = await listShoppingListsForUser(handle.db, ownerId);
    expect(summary!.itemCount).toBe(1);
    expect(summary!.checkedCount).toBe(1);
  });
});

describe("getShoppingListForUser", () => {
  it("returns the list with its items when owned by the caller", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");

    const found = await getShoppingListForUser(handle.db, ownerId, listId);

    expect(found).not.toBeNull();
    expect(found!.name).toBe("Weeknights");
    expect(found!.items).toHaveLength(1);
    expect(found!.items[0]!.name).toBe("onions");
    expect(found!.items[0]!.measures).toEqual([{ quantity: 3, unit: "count" }]);
  });

  it("returns null for another user's list — identical to a non-existent id", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");

    expect(await getShoppingListForUser(handle.db, otherId, listId)).toBeNull();
    expect(await getShoppingListForUser(handle.db, otherId, "does-not-exist")).toBeNull();
  });
});

describe("toggleShoppingListItemForUser", () => {
  it("checks and unchecks an owned item", async () => {
    const { listId, itemId } = await makeList(ownerId, "Weeknights");

    await toggleShoppingListItemForUser(handle.db, ownerId, listId, itemId, true);
    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.items[0]!.checked).toBe(true);

    await toggleShoppingListItemForUser(handle.db, ownerId, listId, itemId, false);
    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.items[0]!.checked).toBe(false);
  });

  it("silently does nothing against a list the caller does not own", async () => {
    const { listId, itemId } = await makeList(ownerId, "Weeknights");

    await toggleShoppingListItemForUser(handle.db, otherId, listId, itemId, true);

    const stillUnchecked = await getShoppingListForUser(handle.db, ownerId, listId);
    expect(stillUnchecked!.items[0]!.checked).toBe(false);
  });
});

describe("renameShoppingListForUser", () => {
  it("renames an owned list", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");

    await renameShoppingListForUser(handle.db, ownerId, listId, "Weeknights v2");

    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.name).toBe(
      "Weeknights v2",
    );
  });

  it("silently does nothing against a list the caller does not own", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");

    await renameShoppingListForUser(handle.db, otherId, listId, "Hijacked");

    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.name).toBe("Weeknights");
  });
});

describe("addShoppingListItemForUser", () => {
  it("appends a name-only item at the next position for an owned list", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");

    await addShoppingListItemForUser(handle.db, ownerId, listId, "milk");

    const found = await getShoppingListForUser(handle.db, ownerId, listId);
    expect(found!.items).toHaveLength(2);
    const added = found!.items[1]!;
    expect(added.name).toBe("milk");
    expect(added.measures).toEqual([]);
    expect(added.checked).toBe(false);
  });

  it("silently does nothing against a list the caller does not own", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");

    await addShoppingListItemForUser(handle.db, otherId, listId, "milk");

    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.items).toHaveLength(1);
  });
});

describe("removeShoppingListItemForUser", () => {
  it("removes an item from an owned list", async () => {
    const { listId, itemId } = await makeList(ownerId, "Weeknights");

    await removeShoppingListItemForUser(handle.db, ownerId, listId, itemId);

    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.items).toHaveLength(0);
  });

  it("silently does nothing against a list the caller does not own", async () => {
    const { listId, itemId } = await makeList(ownerId, "Weeknights");

    await removeShoppingListItemForUser(handle.db, otherId, listId, itemId);

    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.items).toHaveLength(1);
  });
});

describe("hasShoppingListNamedForUser", () => {
  it("is true when the caller has a list with this exact name", async () => {
    await makeList(ownerId, "Weeknights");

    expect(await hasShoppingListNamedForUser(handle.db, ownerId, "Weeknights")).toBe(true);
  });

  it("is false for another user's list with the same name — no cross-user leak", async () => {
    await makeList(otherId, "Weeknights");

    expect(await hasShoppingListNamedForUser(handle.db, ownerId, "Weeknights")).toBe(false);
  });

  it("is false when nothing matches, including after a rename", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");
    expect(await hasShoppingListNamedForUser(handle.db, ownerId, "Weeknights v2")).toBe(false);

    await renameShoppingListForUser(handle.db, ownerId, listId, "Weeknights v2");

    // The rename broke the match on the old name...
    expect(await hasShoppingListNamedForUser(handle.db, ownerId, "Weeknights")).toBe(false);
    // ...and created one on the new name.
    expect(await hasShoppingListNamedForUser(handle.db, ownerId, "Weeknights v2")).toBe(true);
  });
});

describe("createShoppingListForUser for a blank list", () => {
  it("round-trips a blank list with no items", async () => {
    const id = await createShoppingListForUser(handle.db, ownerId, "Costco run", []);

    const found = await getShoppingListForUser(handle.db, ownerId, id);
    expect(found!.name).toBe("Costco run");
    expect(found!.pinned).toBe(false);
    expect(found!.items).toHaveLength(0);
  });
});

describe("togglePinShoppingListForUser", () => {
  it("pins and unpins an owned list", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");

    await togglePinShoppingListForUser(handle.db, ownerId, listId, true);
    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.pinned).toBe(true);

    await togglePinShoppingListForUser(handle.db, ownerId, listId, false);
    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.pinned).toBe(false);
  });

  it("silently does nothing against a list the caller does not own", async () => {
    const { listId } = await makeList(ownerId, "Weeknights");

    await togglePinShoppingListForUser(handle.db, otherId, listId, true);

    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.pinned).toBe(false);
  });

  it("sorts pinned lists first regardless of recency", async () => {
    const { listId: aId } = await makeList(ownerId, "A — pinned later");
    const { listId: bId } = await makeList(ownerId, "B — never pinned");

    // Pin A after the fact — it should now sort ahead of B even though B
    // isn't older by enough for `createdAt` alone to explain the order.
    await togglePinShoppingListForUser(handle.db, ownerId, aId, true);

    const afterPinning = await listShoppingListsForUser(handle.db, ownerId);
    expect(afterPinning.map((l) => l.id)).toEqual([aId, bId]);
  });
});

describe("resetShoppingListCheckedForUser", () => {
  it("unchecks every item on an owned list", async () => {
    const { listId, itemId } = await makeList(ownerId, "Weeknights");
    await toggleShoppingListItemForUser(handle.db, ownerId, listId, itemId, true);

    await resetShoppingListCheckedForUser(handle.db, ownerId, listId);

    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.items[0]!.checked).toBe(
      false,
    );
  });

  it("silently does nothing against a list the caller does not own", async () => {
    const { listId, itemId } = await makeList(ownerId, "Weeknights");
    await toggleShoppingListItemForUser(handle.db, ownerId, listId, itemId, true);

    await resetShoppingListCheckedForUser(handle.db, otherId, listId);

    expect((await getShoppingListForUser(handle.db, ownerId, listId))!.items[0]!.checked).toBe(
      true,
    );
  });
});

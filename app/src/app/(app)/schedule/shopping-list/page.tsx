import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SaveShoppingListButton } from "@/components/shopping-lists/save-shopping-list-button";
import { RangePicker } from "@/components/shopping/range-picker";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/states";
import { config } from "@/lib/config";
import {
  endOfWeek,
  formatDate,
  isIsoDate,
  startOfWeek,
  todayInAppTimeZone,
  type IsoDate,
} from "@/lib/date";
import { aggregate } from "@/lib/shopping/aggregate";
import { ingredientsForRange } from "@/lib/shopping/queries";
import { saveShoppingListFromRangeAction } from "@/lib/shopping-lists/actions";
import { defaultShoppingListNameForRange } from "@/lib/shopping-lists/naming";
import { hasShoppingListNamed } from "@/lib/shopping-lists/queries";

export const metadata: Metadata = { title: "Shopping list · Schedule" };

export default async function ScheduleShoppingListPage({
  searchParams,
}: PageProps<"/schedule/shopping-list">) {
  const params = await searchParams;

  const today = todayInAppTimeZone();
  const weekFrom = startOfWeek(today, config.WEEK_STARTS_ON);
  const weekTo = endOfWeek(today, config.WEEK_STARTS_ON);

  const asDate = (value: unknown, fallback: IsoDate): IsoDate =>
    typeof value === "string" && isIsoDate(value) ? value : fallback;

  let from = asDate(params.from, weekFrom);
  let to = asDate(params.to, weekTo);
  // A reversed range would silently return nothing; swap rather than confuse.
  if (from > to) [from, to] = [to, from];

  const source = await ingredientsForRange(from, to);
  const items = aggregate(source.lines, config.MEASUREMENT_SYSTEM);

  const range = `${formatDate(from)} – ${formatDate(to)}`;
  const alreadySaved =
    items.length > 0 && (await hasShoppingListNamed(defaultShoppingListNameForRange(from, to)));

  return (
    <>
      <PageHeader
        title="Shopping list"
        description={`Everything scheduled between ${range}.`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/schedule">
              <ArrowLeft className="size-4" />
              Schedule
            </Link>
          </Button>
        }
      />

      {/*
        Keyed on the committed range so the picker remounts whenever it
        changes. Its inputs hold local state seeded from these props, which
        React keeps across a re-render — so after a preset, a browser Back, or
        a shared link, the fields would otherwise still show the previous
        range while the list below showed the new one.
      */}
      <RangePicker
        key={`${from}:${to}`}
        from={from}
        to={to}
        weekFrom={weekFrom}
        weekTo={weekTo}
        today={today}
        weekStartsOn={config.WEEK_STARTS_ON}
      />

      <ShoppingList
        items={items}
        heading={`Shopping list — ${range}`}
        mealNames={source.mealNames}
        occurrences={source.occurrences}
        emptyMessage="Nothing is scheduled in this range, or the scheduled meals have no ingredients."
        saveAction={
          <SaveShoppingListButton
            action={saveShoppingListFromRangeAction.bind(null, from, to)}
            alreadySaved={alreadySaved}
          />
        }
      />
    </>
  );
}

import { AddToDaySheet, type SchedulableMeal } from "@/components/schedule/add-to-day-sheet";
import { EntrySheet } from "@/components/schedule/entry-sheet";
import { cn } from "@/lib/cn";
import { describeDate, type IsoDate } from "@/lib/date";
import {
  assignMealsAction,
  moveEntryAction,
  removeEntryAction,
} from "@/lib/schedule/actions";
import {
  SLOT_LABELS,
  SLOTS,
  type DaySchedule,
} from "@/lib/schedule/queries";

const SLOT_OPTIONS = SLOTS.map((value) => ({ value, label: SLOT_LABELS[value] }));

/**
 * One day in the week view.
 *
 * Only slots that contain something are rendered. Showing four empty rows for
 * every one of seven days would push a week to several screens on a phone;
 * the single Add control covers the empty case and lets you pick the slot in
 * the same sheet.
 */
export function DayCard({
  date,
  day,
  meals,
  today,
  weekStartsOn,
  showAllSlots = false,
}: {
  date: IsoDate;
  day: DaySchedule;
  meals: SchedulableMeal[];
  today: IsoDate;
  weekStartsOn: "monday" | "sunday";
  showAllSlots?: boolean;
}) {
  const isToday = date === today;
  const parts = describeDate(date);
  const label = `${parts.weekdayLong} ${parts.day} ${parts.month}`;
  const visibleSlots = showAllSlots
    ? SLOTS
    : SLOTS.filter((slot) => day[slot].length > 0);

  return (
    <section
      className={cn(
        "rounded-2xl border bg-surface",
        isToday ? "border-primary" : "border-line",
      )}
    >
      <header className="flex items-center justify-between gap-3 px-3 py-2.5">
        <h3 className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              isToday ? "text-primary" : "text-ink",
            )}
          >
            {parts.weekday} {parts.day}
          </span>
          <span className="text-xs text-ink-faint">{parts.month}</span>
          {isToday && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-medium text-primary">
              Today
            </span>
          )}
        </h3>

        <AddToDaySheet
          dateLabel={label}
          slots={SLOT_OPTIONS}
          meals={meals}
          action={assignMealsAction.bind(null, date)}
        />
      </header>

      {visibleSlots.length === 0 ? (
        <p className="px-3 pb-3 text-sm text-ink-faint">Nothing planned.</p>
      ) : (
        <dl className="flex flex-col gap-1 border-t border-line px-3 py-2">
          {visibleSlots.map((slot) => (
            <div key={slot} className="flex items-start gap-3 py-0.5">
              <dt className="w-20 shrink-0 pt-2 text-xs font-medium tracking-wide text-ink-faint uppercase">
                {SLOT_LABELS[slot]}
              </dt>
              <dd className="min-w-0 flex-1">
                {day[slot].length === 0 ? (
                  <p className="py-2 text-sm text-ink-faint">—</p>
                ) : (
                  <ul className="flex flex-col">
                    {day[slot].map((entry) => (
                      <li key={entry.entryId} className="flex items-center">
                        <EntrySheet
                          entryId={entry.entryId}
                          mealId={entry.mealId}
                          mealName={entry.name}
                          imageHash={entry.imageHash}
                          date={entry.date}
                          slot={entry.slot}
                          slots={SLOT_OPTIONS}
                          today={today}
                          weekStartsOn={weekStartsOn}
                          moveAction={moveEntryAction.bind(null, entry.entryId)}
                          removeAction={removeEntryAction.bind(null, entry.entryId)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

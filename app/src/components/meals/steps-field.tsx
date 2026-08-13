"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

interface Row {
  key: string;
  text: string;
}

/**
 * A React list key, not a real identifier — mirrors the same reasoning as
 * `meal-form.tsx`'s ingredient rows (no `crypto.randomUUID()`, which is
 * unavailable outside a secure context).
 */
let rowKeySeq = 0;
function nextRowKey(): string {
  return `step-${Date.now().toString(36)}-${(rowKeySeq++).toString(36)}`;
}

/**
 * Ordered method steps for a meal. "Step N" labels are display-only, derived
 * from array position — there is nothing to store or edit beyond the text of
 * each step. Reordering is up/down buttons rather than drag-and-drop: an
 * earlier drag-based version felt glitchy in practice, and buttons are exact
 * and equally usable on desktop and mobile.
 */
export function StepsField({
  name,
  initialSteps,
}: {
  name: string;
  initialSteps: string[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialSteps.length
      ? initialSteps.map((text) => ({ key: nextRowKey(), text }))
      : [{ key: nextRowKey(), text: "" }],
  );

  const update = (key: string, text: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, text } : r)));

  const move = (index: number, delta: number) =>
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const remove = (key: string) =>
    setRows((prev) =>
      prev.length === 1 ? [{ key: nextRowKey(), text: "" }] : prev.filter((r) => r.key !== key),
    );

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <StepRow
            key={row.key}
            row={row}
            index={index}
            total={rows.length}
            name={name}
            onChange={(text) => update(row.key, text)}
            onMoveUp={() => move(index, -1)}
            onMoveDown={() => move(index, 1)}
            onRemove={() => remove(row.key)}
          />
        ))}
      </ul>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setRows((prev) => [...prev, { key: nextRowKey(), text: "" }])}
      >
        <Plus className="size-4" />
        Add step
      </Button>
    </div>
  );
}

function StepRow({
  row,
  index,
  total,
  name,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  row: Row;
  index: number;
  total: number;
  name: string;
  onChange: (text: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const textButton = "text-xs font-medium text-ink-faint hover:text-ink disabled:pointer-events-none disabled:opacity-30";

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink-faint">Step {index + 1}</span>

          {confirmingDelete ? (
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="text-ink-muted">Delete this step?</span>
              <button type="button" onClick={onRemove} className="text-danger hover:underline">
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-ink-muted hover:underline"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-xs font-medium text-danger hover:underline"
            >
              Delete
            </button>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Move step ${index + 1} up`}
            disabled={index === 0}
            onClick={onMoveUp}
            className={textButton}
          >
            Up
          </button>
          <button
            type="button"
            aria-label={`Move step ${index + 1} down`}
            disabled={index === total - 1}
            onClick={onMoveDown}
            className={textButton}
          >
            Down
          </button>
        </div>
      </div>

      <Textarea
        aria-label={`Step ${index + 1}`}
        value={row.text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe this step…"
        className="min-h-16 rounded-none border-0 bg-transparent hover:border-transparent"
      />

      {row.text.trim() !== "" && <input type="hidden" name={name} value={row.text} />}
    </li>
  );
}

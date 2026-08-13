"use client";

import * as Popover from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/cn";

const MAX_SUGGESTIONS = 8;

/**
 * Chip editor for a form's `tags` field. Each chip is a hidden `<input>`
 * sharing `name`, so the surrounding `<form>` collects them the same way it
 * already collects `mealId` checkboxes — via `formData.getAll(name)`.
 *
 * The suggestion dropdown is a real popover, not a native `<datalist>` —
 * iOS Safari doesn't render datalist suggestions at all, which made
 * autocomplete silently do nothing on a phone. Not portalled, matching
 * DateInput's calendar: neither form this lives in sits inside a Dialog, so
 * there is no "outside click" conflict to avoid.
 *
 * With nothing typed yet, `recentTags` pre-fills the dropdown so the most
 * likely picks are visible on focus, before the user types a single letter.
 */
export function TagInput({
  name,
  initialTags,
  suggestions,
  recentTags,
  placeholder = "Add a tag",
}: {
  name: string;
  initialTags: string[];
  suggestions: string[];
  recentTags: string[];
  placeholder?: string;
}) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [focused, setFocused] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const listId = useId();

  function commit(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setTags((prev) =>
      prev.some((t) => t.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value],
    );
    setDraft("");
    setHighlight(0);
  }

  function remove(value: string) {
    setTags((prev) => prev.filter((t) => t !== value));
  }

  const isUnused = (s: string) => !tags.some((t) => t.toLowerCase() === s.toLowerCase());
  const term = draft.trim().toLowerCase();

  let matches: string[];
  let showingRecent: boolean;
  if (term) {
    const unused = suggestions.filter(isUnused);
    // Prefix matches read as more relevant than a match buried mid-word.
    const startsWith = unused.filter((s) => s.toLowerCase().startsWith(term));
    const contains = unused.filter(
      (s) => !s.toLowerCase().startsWith(term) && s.toLowerCase().includes(term),
    );
    matches = [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
    showingRecent = false;
  } else {
    matches = recentTags.filter(isUnused);
    showingRecent = true;
  }
  const activeIndex = Math.min(highlight, matches.length - 1);
  const open = focused && !suppressed && matches.length > 0;

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((prev) => (prev + delta + matches.length) % matches.length);
      return;
    }

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(open ? matches[activeIndex]! : draft);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setSuppressed(true);
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      remove(tags[tags.length - 1]!);
    }
  }

  return (
    <Popover.Root open={open}>
      <Popover.Anchor asChild>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-2 transition-colors focus-within:border-line-strong hover:border-line-strong">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-surface-muted py-1 pr-1 pl-2.5 text-xs font-medium text-ink"
            >
              {t}
              <input type="hidden" name={name} value={t} />
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => remove(t)}
                className="inline-flex size-4 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setHighlight(0);
              setSuppressed(false);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit(draft);
            }}
            placeholder={tags.length === 0 ? placeholder : ""}
            // text-base, not text-sm: iOS auto-zooms the page to fit any
            // focused input whose font-size is under 16px.
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="h-6 min-w-24 flex-1 border-0 bg-transparent p-0 text-base text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
      </Popover.Anchor>

      <Popover.Content
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="z-50 w-[min(16rem,var(--radix-popper-anchor-width))] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg"
      >
        {showingRecent && (
          <p className="px-2.5 pt-1 pb-0.5 text-xs font-medium text-ink-faint">Recently used</p>
        )}
        <ul id={listId} role="listbox">
          {matches.map((s, i) => (
            <li key={s} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                // Keeps focus on the text input — a real blur here would
                // commit the in-progress draft as its own chip first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(s)}
                className={cn(
                  "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm text-ink",
                  i === activeIndex ? "bg-surface-muted" : "hover:bg-surface-muted",
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}

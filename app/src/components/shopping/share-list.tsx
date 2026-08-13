"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/**
 * Copy and share for a shopping list.
 *
 * The list itself is a runtime projection and is never stored, so "taking it
 * with you" means getting the text out of the app: into the clipboard, or
 * straight into Messages/WhatsApp/Notes via the share sheet.
 */
export function ShareList({ text, title }: { text: string; title: string }) {
  const [copied, setCopied] = useState(false);

  /**
   * `navigator.share` exists on phones and almost nowhere on desktop, so the
   * button is only offered when it is real.
   *
   * Read through useSyncExternalStore rather than an effect: the value never
   * changes, and the server snapshot of `false` means the markup matches on
   * both sides and then corrects itself on hydration — no mismatch, and no
   * setState inside an effect.
   */
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && "share" in navigator,
    () => false,
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // Falling back to a selection prompt beats failing silently.
      window.prompt("Copy the list:", text);
    }
  }

  async function share() {
    try {
      await navigator.share({ title, text });
    } catch {
      // A cancelled share sheet rejects; that is not an error worth surfacing.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>

      {canShare && (
        <Button variant="secondary" size="sm" onClick={share}>
          <Share2 className="size-4" />
          Share
        </Button>
      )}
    </div>
  );
}

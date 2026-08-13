"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ink">Something went wrong</p>
        <p className="mx-auto max-w-sm text-sm text-ink-muted">
          {/* The message itself may contain internals, so it is not shown. */}
          The page could not be loaded.
          {error.digest && (
            <>
              {" "}
              Reference <code className="font-mono text-xs">{error.digest}</code>.
            </>
          )}
        </p>
      </div>
      <Button variant="secondary" onClick={reset} className="mt-1">
        Try again
      </Button>
    </div>
  );
}

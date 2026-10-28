"use client";

import * as React from "react";
import { cn } from "./utils";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-end gap-1", className)}>
      <button
        type="button"
        className="rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      {Array.from({ length: pageCount }).map((_, index) => {
        const current = index + 1;
        return (
          <button
            key={current}
            type="button"
            aria-current={current === page ? "page" : undefined}
            className={cn(
              "min-w-7 rounded-sm px-2 py-1 text-xs",
              current === page
                ? "bg-accent-soft font-semibold text-accent"
                : "text-text-muted hover:bg-surface-2 hover:text-text",
            )}
            onClick={() => onPageChange(current)}
          >
            {current}
          </button>
        );
      })}
      <button
        type="button"
        className="rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

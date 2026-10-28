"use client";

import * as React from "react";
import { cn } from "./utils";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  badge?: React.ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  variant = "underline",
  className,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: "underline" | "pill" | "segmented";
  className?: string;
  label?: string;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = items[(index + delta + items.length) % items.length];
      if (next) onChange(next.id);
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? items[0] : items[items.length - 1];
      if (next) onChange(next.id);
    }
  };

  if (variant === "segmented") {
    return (
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn("inline-flex gap-1 rounded-md bg-surface-2 p-1", className)}
      >
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={item.id === value}
            tabIndex={item.id === value ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm transition-colors",
              item.id === value
                ? "bg-surface text-text shadow-card"
                : "text-text-muted hover:text-text",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "flex items-center gap-1 overflow-x-auto scrollbar-thin",
        variant === "underline" && "border-b border-border",
        variant === "pill" && "gap-2",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          type="button"
          aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1}
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors",
            variant === "underline" &&
              cn(
                "-mb-px border-b-2 px-3 py-2",
                item.id === value
                  ? "border-accent text-accent"
                  : "border-transparent text-text-muted hover:text-text",
              ),
            variant === "pill" &&
              cn(
                "rounded-pill px-3 py-1",
                item.id === value
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              ),
          )}
        >
          {item.label}
          {item.badge ? <span className="text-xs text-text-muted">{item.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

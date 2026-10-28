import * as React from "react";
import { cn } from "./utils";

export function Avatar({
  name,
  size = "md",
  square,
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  square?: boolean;
  className?: string;
}) {
  const sizes = {
    xs: "size-5 text-[10px]",
    sm: "size-6 text-xs",
    md: "size-8 text-sm",
    lg: "size-10 text-base",
    xl: "size-14 text-xl",
  } as const;

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-surface-2 font-semibold text-text-muted",
        square ? "rounded-md" : "rounded-pill",
        sizes[size],
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

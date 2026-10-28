import * as React from "react";
import { cn } from "./utils";

export function Skeleton({
  className,
  rounded = "sm",
}: {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "pill";
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-surface-2",
        rounded === "sm" && "rounded-sm",
        rounded === "md" && "rounded-md",
        rounded === "lg" && "rounded-lg",
        rounded === "pill" && "rounded-pill",
        className,
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={index === lines - 1 ? "w-2/5" : "w-full"}
        />
      ))}
    </div>
  );
}

import * as React from "react";
import { cn } from "./utils";

export function EmptyState({
  title,
  description,
  action,
  secondary,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-lg bg-surface-2 text-text-muted"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-text-muted">{description}</p>
      ) : null}
      {action || secondary ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

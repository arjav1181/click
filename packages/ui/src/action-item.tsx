import * as React from "react";
import { cn } from "./utils";
import { Badge } from "./badge";

export interface ActionItemData {
  id: string;
  text: string;
  assigneeName?: string | null;
  dueAt?: string | null;
  status: "open" | "done" | "pushed" | "failed";
  meetingId?: string;
  meetingTitle?: string;
}

export function ActionItemRow({
  item,
  onToggle,
  className,
}: {
  item: ActionItemData;
  onToggle?: (id: string) => void;
  className?: string;
}) {
  const done = item.status === "done";
  const overdue =
    item.dueAt && !done && new Date(item.dueAt).getTime() < Date.now();

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md border border-border bg-surface p-3",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle?.(item.id)}
        aria-label={`Mark "${item.text}" as ${done ? "open" : "done"}`}
        className="mt-0.5 size-4 accent-[var(--color-accent)]"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm text-text", done && "text-text-muted line-through")}>
          {item.text}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          {item.assigneeName ? <span>{item.assigneeName}</span> : null}
          {item.dueAt ? (
            <time dateTime={item.dueAt} className={cn(overdue && "font-semibold text-danger")}>
              Due {new Date(item.dueAt).toLocaleDateString()}
            </time>
          ) : null}
          {item.meetingTitle ? <span>From {item.meetingTitle}</span> : null}
        </div>
      </div>
      {item.status === "pushed" ? <Badge tone="success">Pushed</Badge> : null}
      {item.status === "failed" ? <Badge tone="danger">Push failed</Badge> : null}
      {overdue ? <Badge tone="danger">Overdue</Badge> : null}
    </li>
  );
}
